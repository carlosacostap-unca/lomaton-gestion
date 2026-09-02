## 1. Esquema y datos

- [x] 1.1 Extender la fuente productiva de esquema con `users.registration`, `registrations.profileVersion`, `registrations.selfManagedFields` y `registrations.selfEditedAt`, y verificar que las reglas e índices resultantes pasan las pruebas de esquema.
- [x] 1.2 Definir `mentor_invitations` y `team_mentorships` con estados, relaciones privadas, cascadas e índices únicos por equipo y mentor, y verificar que dos asignaciones incompatibles son rechazadas por PocketBase.
- [x] 1.3 Implementar un backfill idempotente de vínculos de usuario y versiones de perfil existentes, y verificar que una segunda ejecución no introduce cambios ni duplicados.
- [x] 1.4 Actualizar la documentación del esquema y despliegue con las nuevas colecciones, reglas y orden de rollout, y verificar que coincide con la definición aplicada por el MCP.

## 2. Identidad y acceso por rol

- [x] 2.1 Extender los tipos de usuario y la política de bootstrap para reconocer estudiantes, docentes mentores y administradores mediante la inscripción vigente, y verificar con pruebas unitarias todas las combinaciones y reclasificaciones.
- [x] 2.2 Actualizar el endpoint de bootstrap para vincular o limpiar `registration` y `candidate`, devolver el rol derivado y habilitar docentes activos, y verificar con pruebas de integración que un docente no obtiene permisos de candidato.
- [x] 2.3 Adaptar el proveedor de autenticación y la navegación inicial al rol devuelto, y verificar que estudiante, docente, administrador participante y administrador sin inscripción llegan al área correcta.

## 3. Autogestión del perfil

- [x] 3.1 Implementar la proyección privada del perfil propio y sus esquemas estrictos por rol, y verificar que excluye fuente original, metadatos técnicos y campos de terceros.
- [x] 3.2 Implementar el comando versionado de actualización de perfil con allowlist, normalización, sincronización de candidato o mentor, auditoría y `dataVersion`, y verificar atomicidad, rechazo de campos protegidos y conflictos de versión mediante pruebas unitarias.
- [x] 3.3 Cancelar invitaciones pendientes cuando un docente disponible deja de manifestar interés y bloquear el cambio si ya posee mentoría, y verificar ambos escenarios con pruebas del dominio.
- [x] 3.4 Exponer `GET` y `PATCH /api/lomaton/me/profile` con autorización desde la sesión vinculada, y verificar respuestas 401/403/409 y ausencia de filtraciones mediante pruebas de rutas.
- [x] 3.5 Adaptar importación y edición administrativa para preservar campos autogestionados, advertir diferencias y permitir que una corrección administrativa restablezca la base, y verificar reimportación, override y auditoría con pruebas.

## 4. Dominio de mentorías

- [x] 4.1 Implementar consultas mínimas de docentes elegibles, invitaciones y asignación vigente, y verificar que sólo exponen nombre y pertenencia institucional autorizados.
- [x] 4.2 Implementar el comando del responsable para invitar y retirar mentores durante la formación, y verificar propiedad, disponibilidad, interés, duplicados, cierre y equipo ya acompañado.
- [x] 4.3 Implementar aceptación y rechazo por el docente autenticado, con creación atómica de la asignación y cancelación de invitaciones incompatibles, y verificar pertenencia, idempotencia funcional y transiciones de estado.
- [x] 4.4 Proteger aceptaciones concurrentes con índices y manejo de conflictos, y verificar que un docente no puede quedar en dos equipos ni un equipo con dos mentores.
- [x] 4.5 Integrar la limpieza de invitaciones y asignaciones al disolver un equipo, y verificar que el docente vuelve a estar disponible sin alterar las membresías de otros equipos.
- [x] 4.6 Exponer rutas autenticadas para listar, crear, retirar, aceptar y rechazar mentorías, y verificar políticas de estudiante, responsable, docente, administrador y usuario ajeno con pruebas de integración.

## 5. Portal de participantes

- [x] 5.1 Crear el formulario reutilizable de perfil con campos de sólo lectura, campos editables por rol y control de versión, y verificar validación, estados de carga, conflicto y mensajes accesibles.
- [x] 5.2 Crear la entrada de portal por rol, reutilizar certificado y equipo para estudiantes y conservar `/candidate` como redirección compatible, y verificar que el certificado sólo aparece para candidatos.
- [x] 5.3 Incorporar al panel del responsable la selección de docentes elegibles y la gestión de invitaciones de mentoría, y verificar estados sin mentor, pendiente, aceptado, retirado y formación cerrada.
- [x] 5.4 Crear el panel docente con perfil, invitaciones para aceptar o rechazar y resumen seguro del equipo acompañado, y verificar que nunca muestra certificados ni datos privados de integrantes.
- [x] 5.5 Añadir navegación entre portal y administración para identidades con permisos combinados y revisar estilos responsive y accesibilidad con pruebas de interfaz y recorrido por teclado.

## 6. Administración y reportes

- [x] 6.1 Mostrar mentor e invitaciones de mentoría en la gestión administrativa de equipos con acciones de asistencia auditadas, y verificar que no alteran el contador ni el requisito FTCA.
- [x] 6.2 Incorporar mentoría como columnas separadas en la instantánea y exportaciones de equipos, y verificar CSV/XLSX sin datos privados adicionales.
- [x] 6.3 Actualizar la edición administrativa de inscripciones para contemplar vínculos docentes vigentes y marcas de autogestión, y verificar conflictos al desactivar o reclasificar un mentor asignado.

## 7. Verificación y despliegue

- [x] 7.1 Ejecutar pruebas unitarias, de rutas, integración y Playwright del cambio, y verificar que todas finalizan correctamente sin regresiones en certificados ni formación estudiantil.
- [x] 7.2 Ejecutar la compilación de producción y la validación estricta de OpenSpec, y verificar que ambas terminan sin errores ni advertencias accionables.
- [x] 7.3 Aplicar y validar el esquema aditivo en producción antes de desplegar la aplicación, y verificar campos, reglas, índices, privacidad e idempotencia mediante el MCP autorizado.
- [x] 7.4 Realizar una aceptación controlada con estudiante, docente, dos equipos competidores y administrador, y verificar acceso por rol, autogestión, exclusividad, reportes y limpieza completa de datos de prueba.
