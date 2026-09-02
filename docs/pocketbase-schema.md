# Esquema y seguridad de PocketBase

La definición vigente está en `tools/pocketbase-mcp/lomaton-schema.mjs` y se aplica exclusivamente con `apply_lomaton_schema`. Los artefactos bajo `pocketbase/pb_hooks` y `pocketbase/pb_migrations` son antecedentes de la primera implementación y no forman parte del despliegue.

## Colecciones

- `users`: identidad Google y roles sincronizados por bootstrap.
- `service_accounts`: identidad técnica de Next.js, sin OAuth/OTP ni CRUD público.
- `registrations`: respuesta privada completa del formulario, con identidad por email y DNI.
- `candidates`: proyección operativa mínima de estudiantes; conserva `firstName`/`lastName` opcionales sólo por compatibilidad con registros anteriores.
- `mentor_profiles`: proyección privada de docentes y su interés de mentoría.
- `admin_allowlist`: autorización administrativa.
- `teams`, `team_memberships`, `team_invitations`: formación de equipos.
- `hackathon_settings`: plazo, apertura, zona y `dataVersion`.
- `import_batches`: resumen de importaciones.
- `audit_logs`: trazabilidad inmutable.
- `student_certificates`: PDF privado por candidato y revisión administrativa independiente de FTCA/equipos.

Las escrituras de dominio aceptan exclusivamente `active=true && role="lomaton_server"`. `audit_logs` permite creación técnica pero mantiene update/delete bloqueados. `admin_allowlist` sólo se modifica mediante MCP. `registrations` y `mentor_profiles` admiten lectura únicamente administrativa o técnica; DNI, teléfono, datos académicos, consentimientos y respuestas originales no existen en `candidates`. Las lecturas del navegador siguen el rol del usuario.

`users.authRule` exige email verificado presente y activo en padrón o allowlist; `createRule` limita el alta al contexto `oauth2`. Password y OTP están deshabilitados para `users`.

## Integridad

Los índices únicos cubren email y DNI normalizados de inscripción, relación inscripción/candidato, relación inscripción/mentor, email de candidato, email administrativo, candidato vinculado a usuario, nombre de equipo, una membresía por candidato, par equipo/candidato e invitación pendiente por equipo/candidato. Las relaciones desde membresías e invitaciones al equipo tienen `cascadeDelete=true`.

`student_certificates` mantiene unicidad por candidato e índice por `reviewStatus`. Los estados permitidos son `pending`, `approved` y `rejected`; la relación opcional `reviewedBy` apunta a `users`, `reviewedAt` registra la decisión y `rejectionReason` se limita a 1.000 caracteres. `created` y `updated` son campos `autodate` explícitos porque PocketBase 0.40 no los agrega implícitamente a colecciones nuevas. El reemplazo del archivo limpia esos tres metadatos y vuelve a `pending`.

El máximo de cuatro se protege con una actualización condicional del contador en cada Batch. La proyección queda en `draft`, `missing_ftca`, `complete` o `invalid` según membresías y FTCA.

## Estado aplicado

El 1 de septiembre de 2026 el MCP aplicó y validó las doce colecciones y todos los campos esperados. Creó `registrations` y `mentor_profiles`, agregó la proyección privada a `candidates` y reaplicó reglas e índices sin eliminar datos. La consulta anónima de `registrations` devolvió un conjunto vacío, comportamiento con el que PocketBase oculta registros cuando la regla de listado no se cumple; las reglas persistidas limitan lectura a administradores o a la cuenta técnica. API Batch continúa habilitada.

El 2 de septiembre de 2026 se aplicaron los campos e índice de revisión, el backfill informó cero certificados existentes y su segunda ejecución confirmó idempotencia. La aceptación detectó y corrigió aditivamente la ausencia de `created`/`updated` en la colección documental; después cubrió el ciclo completo con un PDF ficticio y restauró la línea base sin residuos E2E.
