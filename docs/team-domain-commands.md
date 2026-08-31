# Comandos de equipos en PocketBase

Las escrituras críticas se exponen bajo `/api/lomaton` y se ejecutan dentro de transacciones PocketBase. Todas requieren un token de la colección `users`; las rutas administrativas además comprueban `isAdmin`.

## Rutas de candidatos

| Método | Ruta | Acción |
| --- | --- | --- |
| `POST` | `/api/lomaton/teams` | Crear equipo e incorporar al responsable |
| `DELETE` | `/api/lomaton/teams/{teamId}` | Disolver el equipo propio |
| `POST` | `/api/lomaton/teams/{teamId}/invitations` | Invitar un candidato disponible |
| `DELETE` | `/api/lomaton/invitations/{invitationId}` | Retirar una invitación pendiente |
| `POST` | `/api/lomaton/invitations/{invitationId}/accept` | Aceptar una invitación propia |
| `POST` | `/api/lomaton/invitations/{invitationId}/reject` | Rechazar una invitación propia |

Cada ruta comprueba apertura manual y plazo UTC usando el reloj del servidor. No existe una ruta de candidato para expulsar miembros aceptados.

Al aceptar una invitación se vuelve a comprobar, dentro de la transacción, que el candidato no tenga equipo y que el equipo tenga menos de cuatro miembros. La membresía, la resolución de la invitación, la cancelación de las demás invitaciones pendientes y el recálculo del equipo forman una sola operación. Si el equipo se llenó antes de aceptar, esa invitación queda `cancelled` y la respuesta es HTTP 409.

## Rutas administrativas

| Método | Ruta | Acción |
| --- | --- | --- |
| `PATCH` | `/api/lomaton/admin/settings` | Cambiar plazo UTC y apertura manual |
| `POST` | `/api/lomaton/admin/teams` | Crear un equipo en representación de un candidato |
| `PATCH` | `/api/lomaton/admin/teams/{teamId}` | Renombrar o cambiar responsable |
| `PUT` | `/api/lomaton/admin/teams/{teamId}/members/{candidateId}` | Incorporar miembro |
| `DELETE` | `/api/lomaton/admin/teams/{teamId}/members/{candidateId}` | Retirar miembro no responsable |
| `DELETE` | `/api/lomaton/admin/teams/{teamId}` | Disolver equipo |
| `POST` | `/api/lomaton/admin/invitations/{invitationId}/resolve` | Aceptar, rechazar o cancelar invitación |
| `POST` | `/api/lomaton/admin/reconcile-teams` | Recalcular todas las proyecciones |

Una intervención administrativa sigue respetando un equipo por candidato y cuatro miembros como máximo. Cuando la formación está cerrada o el plazo venció, `reason` es obligatorio. Cada cambio agrega un `audit_logs` con actor, entidad, valores anteriores/posteriores, motivo y metadatos pertinentes.

Para cambiar el responsable y retirar al anterior se hacen dos operaciones: primero `PATCH` con un nuevo responsable que ya pertenezca al equipo y luego `DELETE` sobre la membresía anterior. Esto evita equipos con un responsable que no sea miembro.

## Estado derivado

`recalculateTeam` usa exclusivamente `team_memberships` y el `ftcaStatus` actual:

- menos de tres miembros: `draft`;
- tres o cuatro sin FTCA confirmado: `missing_ftca`;
- tres o cuatro con al menos un FTCA confirmado: `complete`;
- más de cuatro registros, posible sólo por una alteración externa/inconsistente: `invalid`.

Las invitaciones no intervienen en los conteos. La rutina administrativa de reconciliación compara la proyección persistida con los datos fuente, corrige divergencias y audita cada corrección.

## Verificación local 0.40.1

Se verificaron estos resultados sobre una instancia aislada:

- creación normaliza espacios exteriores e interiores y agrega al responsable;
- nombre de equipo e invitación pendiente duplicados reciben HTTP 400 por índice único;
- un candidato puede mantener invitaciones pendientes desde equipos distintos;
- un usuario que no es responsable recibe HTTP 403 al intentar invitar;
- aceptar crea una membresía y cancela las otras invitaciones pendientes;
- rechazo y retiro conservan al candidato disponible;
- disolver elimina las membresías y libera al responsable;
- tres miembros sin FTCA producen `missing_ftca`;
- tres o cuatro miembros con FTCA producen `complete`;
- un quinto invitado es rechazado con HTTP 409;
- si el equipo se llena antes de aceptar, la respuesta es HTTP 409 y la invitación queda `cancelled`;
- dos aceptaciones simultáneas por el cuarto lugar producen HTTP 200 y 409, con cuatro membresías persistidas;
- el administrador pudo crear, renombrar, cambiar responsable, agregar y retirar miembros, resolver una invitación y disolver;
- tras el cierre, una acción de candidato recibió HTTP 409 y una intervención administrativa sin motivo recibió HTTP 400;
- una proyección alterada deliberadamente fue detectada y corregida por reconciliación;
- las operaciones administrativas produjeron registros de auditoría inmutables.
