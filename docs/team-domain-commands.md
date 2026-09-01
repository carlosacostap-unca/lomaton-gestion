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
| `GET` | `/api/lomaton/certificates/me` | Consultar metadatos del certificado propio |
| `POST` | `/api/lomaton/certificates/me` | Cargar o reemplazar el PDF propio |
| `GET` | `/api/lomaton/certificates/me/download` | Descargar el PDF propio mediante proxy privado |

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
| `GET` | `/api/lomaton/admin/candidates/{id}/certificate` | Consultar metadatos privados del certificado |
| `GET` | `/api/lomaton/admin/candidates/{id}/certificate/download` | Descargar el certificado como administrador |

Después del cierre, toda intervención de equipos, invitaciones, candidatos o reconciliación requiere `reason`. Las operaciones dejan auditoría con actor, antes/después y metadatos.

La confirmación de importaciones vive en `/api/imports/candidates/confirm`; realiza upsert, proyecciones afectadas, resumen, auditoría y versión en un Batch. Las exportaciones leen una instantánea protegida por `dataVersion`.

Los certificados viven en `student_certificates`, fuera de la proyección operativa. Next.js valida el PDF y ejecuta archivo, auditoría y aumento de `dataVersion` en un único Batch. Las rutas nunca entregan el hash, el nombre interno de PocketBase, el token protegido ni la URL del storage.
