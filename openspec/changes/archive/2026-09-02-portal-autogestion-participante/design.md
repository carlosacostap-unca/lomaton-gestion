## Context

La aplicación usa Next.js como interfaz y capa de comandos, PocketBase como persistencia y Google OAuth como única identidad. La sesión `users` hoy se vincula opcionalmente con `candidates`; el bootstrap sólo reconoce candidatos activos y administradores. Las inscripciones completas y los perfiles docentes son privados y las operaciones de dominio se ejecutan con una cuenta técnica.

Los equipos representan únicamente candidatos mediante `team_memberships`. Sus invitaciones, límite de cuatro y proyección FTCA ya se protegen con comandos de servidor, Batch e índices. El certificado también está ligado exclusivamente al candidato. La solución debe extender estos modelos sin debilitar esas fronteras; véase `proposal.md` y los deltas de especificación.

## Goals / Non-Goals

**Goals:**

- Identificar en la sesión una única inscripción vigente y derivar de ella el rol de participante.
- Exponer una proyección segura y versionada del perfil propio mediante API de servidor.
- Mantener sincronizadas la inscripción y las proyecciones de candidato o mentor.
- Modelar invitaciones y asignaciones de mentoría con consentimiento y unicidad concurrente en ambos extremos.
- Reutilizar las capacidades estudiantiles existentes dentro de una experiencia de portal por rol.
- Preservar ediciones del titular frente a reimportaciones posteriores y mantener trazabilidad.

**Non-Goals:**

- Permitir que un docente sea miembro, responsable o componente FTCA de un equipo.
- Permitir que un docente cargue certificados de alumno regular.
- Permitir al titular cambiar identidad, clasificación, estado FTCA, consentimientos o respuestas históricas.
- Crear mensajería entre mentor y equipo, agenda, evaluación o seguimiento de actividades.
- Implementar la renuncia o sustitución autónoma de una mentoría ya aceptada; inicialmente requerirá intervención administrativa o disolución del equipo.

## Decisions

### 1. Vincular `users` con la inscripción y derivar el rol

Se agregará a `users` una relación opcional y única `registration`, manteniendo la relación `candidate` para compatibilidad con los comandos estudiantiles. El bootstrap buscará por email normalizado una inscripción vigente y sus proyecciones:

- estudiante activo: asigna `registration` y `candidate`;
- docente con `mentor_profiles.active=true`: asigna `registration` y deja `candidate` vacío;
- administrador sin inscripción: conserva ambos vínculos vacíos;
- participante desactivado o reclasificado: limpia los vínculos que dejaron de corresponder.

El rol se derivará de `registrations.relationship` en el servidor y se devolverá en el bootstrap; no se persistirá una segunda etiqueta de rol que pueda quedar desincronizada. La autorización docente no exigirá `mentorInterest=yes`: el docente debe poder entrar para actualizar ese dato, aunque sólo será invitable cuando el interés sea afirmativo.

Se descarta crear otra colección de autenticación para docentes porque duplicaría OAuth, sesiones y administración de identidades.

### 2. Mantener las inscripciones privadas detrás de una proyección de servidor

Las reglas directas de `registrations` y `mentor_profiles` seguirán sin permitir lectura general del navegador. Se incorporarán endpoints autenticados equivalentes a:

- `GET /api/lomaton/me/profile`: resuelve `user.registration` y devuelve sólo campos normalizados permitidos, rol, editabilidad y una versión opaca;
- `PATCH /api/lomaton/me/profile`: valida una estructura estricta según el rol, exige la versión consultada y ejecuta una actualización atómica.

La lista de escritura será cerrada: teléfono para ambos roles; unidad académica, carrera y departamento para estudiantes cuando correspondan; departamento, descripción externa e interés de mentoría para docentes. Los campos omitidos no cambiarán y cualquier propiedad desconocida o protegida invalidará la solicitud completa.

`registrations` incorporará un contador `profileVersion`, un conjunto acotado `selfManagedFields` y una fecha `selfEditedAt`. Cada edición del titular incrementará la versión, marcará los campos afectados, actualizará normalizaciones y proyecciones, registrará auditoría e incrementará `dataVersion` en un único Batch. Los comandos comprobarán la versión esperada para evitar pérdidas por concurrencia.

La importación preservará los campos marcados como autogestionados y mostrará la discrepancia en la vista previa. Una corrección administrativa explícita podrá sobrescribirlos y quitar sus marcas, dejando la nueva versión como base. Se descarta guardar un perfil paralelo porque generaría dos fuentes de verdad para la misma inscripción.

Si un docente sin asignación cambia `mentorInterest` desde `yes`, el mismo Batch cancelará sus invitaciones pendientes. Si posee una mentoría, el cambio se rechazará hasta que administración resuelva el vínculo.

### 3. Representar la mentoría con dos colecciones separadas

Se crearán:

- `mentor_invitations`: `team`, `mentor`, `invitedBy`, estado (`pending`, `accepted`, `rejected`, `withdrawn`, `cancelled`), `resolvedAt` y fechas. Tendrá unicidad parcial por equipo/docente mientras esté pendiente.
- `team_mentorships`: `team`, `mentor`, origen y fechas. Tendrá índices únicos independientes para `team` y `mentor`.

Ambas relaciones al equipo usarán borrado en cascada. La asignación separada evita contaminar `team_memberships`, mantiene intactos el límite de cuatro y la proyección FTCA, y permite consultar mentoría sin ramas especiales en cada membresía. Se descarta un campo `mentor` dentro de `teams` porque complica el historial de invitaciones y la exclusividad del docente entre equipos.

### 4. Resolver invitaciones mediante comandos transaccionales

Todas las escrituras de mentoría pasarán por la API de dominio con cuenta técnica. La identidad se resolverá desde la sesión, nunca desde un identificador de mentor aportado por el cliente para una aceptación.

El responsable del equipo podrá invitar o retirar mientras la formación esté abierta. Para invitar, el comando comprobará propiedad del equipo, ausencia de mentor, perfil docente activo, `mentorInterest=yes`, ausencia de asignación y ausencia de invitación duplicada.

Al aceptar, un único Batch:

1. verifica que la invitación siga pendiente y pertenezca al docente autenticado;
2. crea `team_mentorships`;
3. marca la invitación elegida como aceptada;
4. cancela todas las invitaciones pendientes del mismo docente y del mismo equipo;
5. registra auditoría e incrementa `dataVersion`.

Los índices únicos de `team_mentorships` son la última barrera frente a aceptaciones simultáneas; sus conflictos se traducirán a una respuesta 409 recargable. El rechazo y retiro conservan la asignación inexistente y sólo transicionan la invitación correspondiente.

### 5. Servir lecturas mínimas para selección y paneles

El portal consumirá proyecciones de servidor en lugar de listar directamente inscripciones docentes. El responsable verá sólo docentes elegibles con nombre, departamento o descripción institucional necesaria. El docente verá nombre, estado e integrantes operativos de su equipo asignado, sin DNI, teléfonos, inscripciones completas ni certificados.

La instantánea administrativa y las exportaciones de equipos incorporarán al mentor en columnas separadas. Nunca se añadirá al arreglo o contador de integrantes.

### 6. Unificar la experiencia en un portal por rol

Se introducirá una entrada de participante común, conservando `/candidate` como redirección compatible. El portal compondrá:

- estudiante: perfil propio, componente existente de certificado, equipo e invitaciones estudiantiles;
- docente: perfil propio, invitaciones de mentoría y resumen de equipo acompañado;
- participante administrador: navegación explícita entre portal y administración.

Esta composición evita duplicar la lógica ya probada de certificados y equipos. Las APIs, y no la visibilidad de botones, seguirán siendo la frontera de autorización.

### 7. Aplicar el esquema desde la fuente productiva y cubrirlo con pruebas

La evolución se realizará de manera aditiva en `tools/pocketbase-mcp/lomaton-schema.mjs`, que es la fuente de despliegue vigente. Las migraciones históricas y hooks heredados no se tratarán como mecanismo productivo.

Las pruebas unitarias cubrirán políticas de bootstrap, allowlists de campos, preservación de autogestión y comandos de mentoría. Las pruebas de integración cubrirán reglas privadas, vinculación docente, operaciones Batch e índices. Las pruebas de interfaz cubrirán ambos portales y los flujos de aceptación/rechazo.

## Risks / Trade-offs

- [Una reimportación podría sobrescribir datos corregidos por el titular] → Persistir `selfManagedFields`, mostrar diferencias y preservar esos campos salvo corrección administrativa explícita.
- [Una sesión antigua podría conservar un rol obsoleto] → Recalcular vínculos en bootstrap y renovar autorización en los endpoints sensibles.
- [Aceptaciones simultáneas podrían asignar dos mentores] → Batch de dominio, índices únicos por equipo y mentor, y conflictos 409.
- [La proyección docente podría filtrar datos privados] → Respuestas construidas con allowlist de servidor y pruebas negativas de privacidad.
- [El despliegue de aplicación antes del esquema rompería el bootstrap] → Aplicar primero el esquema aditivo, verificarlo y luego desplegar la aplicación compatible.
- [Bloquear la renuncia autónoma limita flexibilidad] → Mantener intervención administrativa inicialmente y evaluar un flujo consentido separado en otro cambio.

## Migration Plan

1. Aplicar aditivamente los campos de usuario e inscripción y las colecciones de mentoría, reglas e índices; validar idempotencia y privacidad.
2. Inicializar `profileVersion` y marcas de autogestión vacías en las inscripciones existentes.
3. Vincular usuarios existentes con su inscripción por email normalizado durante un backfill idempotente; el bootstrap completará también vínculos faltantes en futuros accesos.
4. Desplegar bootstrap, APIs de perfil, importación adaptada y comandos de mentoría.
5. Desplegar el portal por rol, la selección de mentores y la visibilidad administrativa/reportes.
6. Ejecutar pruebas de aceptación con un estudiante, un docente, dos equipos competidores y un administrador; eliminar los datos de prueba.

Para rollback, la aplicación anterior puede ignorar las colecciones y campos aditivos. Antes de retirar el código nuevo se deshabilitarán las rutas de escritura; las asignaciones creadas se conservarán para recuperación o se exportarán antes de una limpieza administrativa explícita.

