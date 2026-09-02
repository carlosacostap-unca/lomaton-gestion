## Context

La motivación se encuentra en [proposal.md](./proposal.md). Actualmente la mentoría se forma mediante invitaciones creadas por responsables estudiantiles, aceptadas o rechazadas por docentes y restringidas por dos índices únicos: uno por equipo y otro por docente. El área administrativa sólo puede cancelar invitaciones pendientes o retirar asignaciones ya creadas. Los contratos observables nuevos están en [specs/team-formation/spec.md](./specs/team-formation/spec.md) y [specs/hackathon-administration/spec.md](./specs/hackathon-administration/spec.md).

## Goals / Non-Goals

**Goals:**

- Hacer que toda creación o reemplazo de mentoría pase por una operación autenticada como administrador.
- Conservar la garantía estructural de un mentor máximo por equipo y eliminar toda restricción de cantidad de equipos por docente.
- Mantener visibles las asignaciones para estudiantes y docentes sin exponer datos privados.
- Desactivar de manera definitiva la resolución de invitaciones pendientes anteriores, preservándolas como historial.

**Non-Goals:**

- Convertir al mentor en integrante, responsable o participante del cálculo FTCA.
- Asignar más de un mentor al mismo equipo.
- Eliminar físicamente el historial de invitaciones de mentoría o cambiar la pregunta de interés docente del padrón.
- Imponer un cupo configurable o recomendado de equipos por docente.

## Decisions

### 1. Introducir una operación administrativa de asignación o reemplazo por equipo

Se incorporará una operación administrativa que reciba equipo, docente y motivo. Validará que el equipo exista y que el perfil docente esté activo y tenga interés afirmativo. Si el equipo no tiene mentor, creará una asignación con origen `admin`; si ya tiene uno, actualizará esa misma asignación. La operación incrementará la versión de datos y auditará los valores anterior y posterior. El retiro administrativo continuará eliminando únicamente la asignación indicada.

La ruta se ubicará bajo el espacio `/api/lomaton/admin/teams/:teamId/mentor`, protegida por la validación administrativa existente. El motivo seguirá siendo opcional mientras la formación esté abierta y obligatorio después del cierre.

**Alternativa considerada:** crear una invitación en nombre de administración y esperar la aceptación docente. Se descarta porque mantendría el flujo que el cambio busca eliminar.

### 2. Conservar unicidad por equipo y eliminar unicidad por docente

La definición canónica de `team_mentorships` y una migración de PocketBase eliminarán `idx_team_mentorships_mentor` y conservarán `idx_team_mentorships_team`. De este modo, el almacén garantiza un mentor máximo por equipo mientras acepta cualquier cantidad de filas con el mismo docente.

**Alternativa considerada:** introducir una tabla intermedia o un campo multiselección. Se descarta porque el modelo actual ya representa correctamente la relación muchos-a-uno después de retirar el índice sobrante y mantiene consultas y auditoría simples.

### 3. Retirar el flujo operativo de invitaciones sin borrar su historia

Se eliminarán de las rutas públicas los endpoints para listar docentes elegibles, crear o retirar invitaciones de mentoría y aceptar o rechazarlas. También se retirarán sus comandos interactivos. La colección `mentor_invitations` se mantendrá para reportes históricos, pero una migración marcará como `cancelled` todas las filas pendientes y completará su fecha de resolución. No se crearán nuevas filas después del despliegue.

**Alternativa considerada:** eliminar la colección y sus registros. Se descarta porque destruiría trazabilidad y complicaría reportes históricos.

### 4. Separar los DTO según cada audiencia

El estado estudiantil de mentoría devolverá sólo la asignación vigente; la tarjeta del equipo mostrará el docente o indicará que la organización aún no lo asignó. El tablero docente consultará todas las asignaciones del perfil y devolverá una lista de equipos con sus integrantes operativos. El informe administrativo seguirá incluyendo mentores y asignaciones, y la interfaz añadirá un selector por equipo que incluye a todos los perfiles activos con interés afirmativo, aunque ya estén asignados.

**Alternativa considerada:** reutilizar el DTO singular del docente y mostrar sólo una asignación. Se descarta porque ocultaría parte del nuevo estado permitido.

### 5. Usar una actualización atómica para reemplazos

La asignación o reemplazo y su registro de auditoría se enviarán en el mismo lote que el incremento de versión. El índice único por equipo seguirá resolviendo carreras de creación. Un reemplazo actualizará la fila existente en vez de borrar y recrear, para reducir estados intermedios y conservar una identidad estable de la asignación.

## Risks / Trade-offs

- [Un cliente antiguo intenta resolver una invitación] → Retirar las rutas públicas y cancelar todas las invitaciones pendientes durante la migración.
- [Una interfaz o validación sigue suponiendo una sola asignación por docente] → Cambiar el DTO docente a una colección y cubrir múltiples equipos en pruebas unitarias, de integración y aceptación.
- [Dos administradores modifican simultáneamente el mentor de un equipo] → Mantener el índice único por equipo, usar lotes y traducir conflictos a un error recuperable que solicite actualizar la pantalla.
- [Rollback después de crear asignaciones múltiples para un docente] → Antes de restaurar el índice único anterior, detectar docentes duplicados y resolver manualmente sus asignaciones; el rollback no deberá descartar equipos silenciosamente.
- [La colección histórica parece seguir activa] → No exponer endpoints de escritura ni controles de UI y documentar que `mentor_invitations` queda sólo para trazabilidad.

## Migration Plan

1. Actualizar la definición canónica y agregar una migración que quite el índice único por docente y cancele invitaciones pendientes con fecha de resolución.
2. Desplegar los comandos y rutas administrativas, junto con la retirada de rutas de invitación estudiantil y docente.
3. Desplegar las vistas de administración, estudiantes y docentes adaptadas al nuevo DTO.
4. Ejecutar pruebas de esquema, dominio, rutas, componentes y aceptación; confirmar que el mismo docente puede quedar asignado a varios equipos y que cada equipo continúa con un único mentor.

Para revertir, primero se debe comprobar que ningún docente tenga más de una asignación. Si existen duplicados, administración deberá resolverlos explícitamente antes de restaurar el índice único por docente y el código anterior. Las invitaciones canceladas permanecerán como historial y no se reabrirán automáticamente.
