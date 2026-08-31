# MCP de PocketBase para Lomatón

Servidor registrado como `pocketbase-lomaton-production`. Rechaza cualquier destino distinto de `https://pb-lomaton.epixum.com`.

Las credenciales `_superusers` se leen sólo desde `.env.local` para administrar el esquema mediante MCP. Nunca se versionan ni se copian al runtime Next.js. Las credenciales `POCKETBASE_SERVICE_*` corresponden a la identidad limitada usada por Next.js.

Protecciones:

- `POCKETBASE_ALLOW_WRITES=false` por defecto.
- `POCKETBASE_ALLOW_DELETES=false` bloquea eliminaciones aunque se habiliten escrituras.
- `apply_lomaton_schema` es idempotente y no elimina elementos.
- `ensure_service_account` no devuelve contraseña ni token.
- `validate_hackathon_schema` valida colecciones y campos.
- `get_batch_settings`/`update_batch_settings` sólo exponen el bloque Batch.

Habilitar escrituras únicamente durante una operación revisada y volver luego a sólo lectura. El detalle operativo y rollback está en `docs/deployment-pocketbase.md`.
