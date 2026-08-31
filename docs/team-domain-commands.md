# Comandos de dominio en Next.js

Las rutas `/api/lomaton/**` son Route Handlers de Next.js. Validan el token humano y escriben en PocketBase con la cuenta técnica mediante Batch API.

## Candidatos

| Método | Ruta | Acción |
| --- | --- | --- |
| `POST` | `/api/lomaton/teams` | Crear equipo e incorporar al responsable |
| `DELETE` | `/api/lomaton/teams/{teamId}` | Disolver el equipo propio |
| `POST` | `/api/lomaton/teams/{teamId}/invitations` | Invitar candidato |
| `DELETE` | `/api/lomaton/invitations/{invitationId}` | Retirar invitación |
| `POST` | `/api/lomaton/invitations/{invitationId}/accept` | Aceptar invitación |
| `POST` | `/api/lomaton/invitations/{invitationId}/reject` | Rechazar invitación |

Los comandos exigen formación abierta y plazo vigente. Aceptar incorpora al candidato, resuelve esa invitación, cancela las restantes, recalcula el equipo e incrementa la versión en una transacción.

## Administración

| Método | Ruta | Acción |
| --- | --- | --- |
| `GET` | `/api/lomaton/admin/report-snapshot` | Instantánea consistente |
| `PATCH` | `/api/lomaton/admin/settings` | Plazo y apertura |
| `POST/PATCH/DELETE` | `/api/lomaton/admin/teams[/{teamId}]` | Crear, editar o disolver |
| `PUT/DELETE` | `/api/lomaton/admin/teams/{teamId}/members/{candidateId}` | Incorporar o retirar miembro |
| `POST` | `/api/lomaton/admin/invitations/{id}/resolve` | Resolver invitación |
| `POST` | `/api/lomaton/admin/reconcile-teams` | Recalcular proyecciones |
| `PATCH` | `/api/lomaton/admin/candidates/{id}` | Editar candidato y FTCA |

Después del cierre, toda intervención de equipos, invitaciones, candidatos o reconciliación requiere `reason`. Las operaciones dejan auditoría con actor, antes/después y metadatos.

La confirmación de importaciones vive en `/api/imports/candidates/confirm`; realiza upsert, proyecciones afectadas, resumen, auditoría y versión en un Batch. Las exportaciones leen una instantánea protegida por `dataVersion`.
