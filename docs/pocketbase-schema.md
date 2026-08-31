# Esquema y seguridad de PocketBase

La definición vigente está en `tools/pocketbase-mcp/lomaton-schema.mjs` y se aplica exclusivamente con `apply_lomaton_schema`. Los artefactos bajo `pocketbase/pb_hooks` y `pocketbase/pb_migrations` son antecedentes de la primera implementación y no forman parte del despliegue.

## Colecciones

- `users`: identidad Google y roles sincronizados por bootstrap.
- `service_accounts`: identidad técnica de Next.js, sin OAuth/OTP ni CRUD público.
- `candidates` y `admin_allowlist`: padrón y autorización administrativa.
- `teams`, `team_memberships`, `team_invitations`: formación de equipos.
- `hackathon_settings`: plazo, apertura, zona y `dataVersion`.
- `import_batches`: resumen de importaciones.
- `audit_logs`: trazabilidad inmutable.

Las escrituras de dominio aceptan exclusivamente `active=true && role="lomaton_server"`. `audit_logs` permite creación técnica pero mantiene update/delete bloqueados. `admin_allowlist` sólo se modifica mediante MCP. Las lecturas del navegador siguen el rol del usuario.

`users.authRule` exige email verificado presente y activo en padrón o allowlist; `createRule` limita el alta al contexto `oauth2`. Password y OTP están deshabilitados para `users`.

## Integridad

Los índices únicos cubren email de candidato, email administrativo, candidato vinculado a usuario, nombre de equipo, una membresía por candidato, par equipo/candidato e invitación pendiente por equipo/candidato. Las relaciones desde membresías e invitaciones al equipo tienen `cascadeDelete=true`.

El máximo de cuatro se protege con una actualización condicional del contador en cada Batch. La proyección queda en `draft`, `missing_ftca`, `complete` o `invalid` según membresías y FTCA.

## Estado aplicado

El 31 de agosto de 2026 el MCP validó las diez colecciones y todos los campos esperados, creó la cuenta técnica limitada y confirmó su autenticación. API Batch quedó habilitada y una transacción reversible verificó que el valor final de `dataVersion` permaneciera sin cambios. Una escritura anónima fue rechazada por API Rules.
