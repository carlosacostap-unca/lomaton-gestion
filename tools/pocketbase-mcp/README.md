# MCP de PocketBase para Lomatón

Servidor registrado como `pocketbase-lomaton-production`. Rechaza cualquier destino distinto de `https://pb-lomaton.epixum.com`.

Las credenciales `_superusers` se leen sólo desde `.env.local` para administrar el esquema mediante MCP. Nunca se versionan ni se copian al runtime Next.js. Las credenciales `POCKETBASE_SERVICE_*` corresponden a la identidad limitada usada por Next.js.

Protecciones:

- `POCKETBASE_ALLOW_WRITES=true` por decisión operativa explícita para este proyecto.
- `POCKETBASE_ALLOW_DELETES=false` bloquea eliminaciones aunque se habiliten escrituras.
- `apply_lomaton_schema` es idempotente y no elimina elementos.
- `ensure_service_account` no devuelve contraseña ni token.
- `validate_hackathon_schema` valida colecciones y campos.
- `get_batch_settings`/`update_batch_settings` sólo exponen el bloque Batch.

Aunque las escrituras permanezcan habilitadas, ejecutar sólo operaciones revisadas y mantener `POCKETBASE_ALLOW_DELETES=false` salvo una limpieza puntual autorizada. El detalle operativo y rollback está en `docs/deployment-pocketbase.md`.

El contrato incluye `student_certificates`: relación única por candidato, archivo PDF protegido y acceso directo exclusivo de la cuenta técnica. iDrive E2 permanece detrás de PocketBase; este MCP no necesita ni expone sus credenciales.
