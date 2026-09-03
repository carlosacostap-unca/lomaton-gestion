# Esquema y seguridad de PocketBase

La definición vigente está en `tools/pocketbase-mcp/lomaton-schema.mjs` y se aplica exclusivamente con `apply_lomaton_schema`. Los artefactos bajo `pocketbase/pb_hooks` y `pocketbase/pb_migrations` son antecedentes de la primera implementación y no forman parte del despliegue.

## Colecciones

- `users`: identidad Google y vínculos de inscripción, candidato y jurado sincronizados por bootstrap; admite áreas simultáneas.
- `service_accounts`: identidad técnica de Next.js, sin OAuth/OTP ni CRUD público.
- `registrations`: respuesta privada completa del formulario, con identidad por email y DNI, versión de perfil y marcas de campos autogestionados.
- `candidates`: proyección operativa mínima de estudiantes; conserva `firstName`/`lastName` opcionales sólo por compatibilidad con registros anteriores.
- `mentor_profiles`: proyección privada de docentes y su interés de mentoría.
- `mentor_invitations`: invitaciones privadas entre un equipo y un docente, con historial de resolución.
- `team_mentorships`: asignación vigente separada de las membresías estudiantiles.
- `admin_allowlist`: autorización administrativa.
- `teams`, `team_memberships`, `team_invitations`: formación de equipos; `teams.challenge` conserva opcionalmente uno de los cinco identificadores oficiales de desafío.
- `hackathon_settings`: plazo, apertura, zona y `dataVersion`.
- `import_batches`: resumen de importaciones.
- `audit_logs`: trazabilidad inmutable.
- `student_certificates`: PDF privado por candidato y revisión administrativa independiente de FTCA/equipos.
- `jurors`: nómina evaluadora por nombre, correo normalizado único y estado activo.
- `evaluation_cycles`: ciclo abierto, cancelado o publicado con instantánea de cantidades, versión y responsables.
- `jury_evaluations`: par único ciclo-jurado-equipo, puntajes enteros, criterios completados, total en centésimos y estado.
- `evaluation_results`: agregado inmutable por ciclo y equipo que se crea al publicar.

Las escrituras de dominio aceptan exclusivamente `active=true && role="lomaton_server"`. `audit_logs` permite creación técnica pero mantiene update/delete bloqueados. `admin_allowlist` sólo se modifica mediante MCP. `registrations` y `mentor_profiles` admiten lectura únicamente administrativa o técnica; DNI, teléfono, datos académicos, consentimientos y respuestas originales no existen en `candidates`. Las lecturas del navegador siguen el rol del usuario.

`users.authRule` exige email verificado presente y activo en candidatos, docentes habilitados, jurados o allowlist; `createRule` limita el alta al contexto `oauth2`. Password y OTP están deshabilitados para `users`.

## Integridad

Los índices únicos cubren email y DNI normalizados de inscripción, relación inscripción/usuario, relación inscripción/candidato, relación inscripción/mentor, email de candidato, email administrativo, candidato vinculado a usuario, nombre de equipo, una membresía por candidato, par equipo/candidato e invitación pendiente por equipo/candidato. `team_mentorships` agrega unicidad independiente por equipo y por mentor; `mentor_invitations` evita duplicar el mismo par mientras esté pendiente. Las relaciones desde membresías, invitaciones y mentorías al equipo tienen `cascadeDelete=true`.

Las inscripciones aceptan actualización técnica condicionada por `expected_profile_version`. El portal expone una proyección propia por Route Handler, no la colección privada: teléfono es editable para ambos roles; estudiantes pueden mantener unidad académica, carrera y departamento; docentes pueden mantener departamento, descripción institucional e interés. Cada escritura incrementa `profileVersion`, conserva `selfManagedFields`, audita e incrementa `dataVersion` en el mismo Batch.

Un mentor nunca forma parte de `team_memberships`, no aumenta `memberCount` y no participa de `ftcaConfirmedCount`. La aceptación crea una asignación y cancela en el mismo Batch las invitaciones pendientes incompatibles; los índices únicos resuelven la última carrera concurrente.

`student_certificates` mantiene unicidad por candidato e índice por `reviewStatus`. Los estados permitidos son `pending`, `approved` y `rejected`; la relación opcional `reviewedBy` apunta a `users`, `reviewedAt` registra la decisión y `rejectionReason` se limita a 1.000 caracteres. `created` y `updated` son campos `autodate` explícitos porque PocketBase 0.40 no los agrega implícitamente a colecciones nuevas. El reemplazo del archivo limpia esos tres metadatos y vuelve a `pending`.

El máximo de cuatro se protege con una actualización condicional del contador en cada Batch. La proyección queda en `draft`, `missing_ftca`, `complete` o `invalid` según membresías y FTCA.

Las cuatro colecciones de evaluación aceptan acceso directo exclusivamente de la cuenta técnica. Sus índices garantizan un único correo de jurado, un solo ciclo abierto, un único par ciclo-jurado-equipo y un resultado por ciclo-equipo. La relación opcional de usuario a jurado también es única. Los cinco pesos son 25, 25, 20, 15 y 15 por ciento; un cero se distingue de un criterio todavía no completado mediante `completedCriteria`.

## Estado aplicado

El 1 de septiembre de 2026 el MCP aplicó y validó las doce colecciones y todos los campos esperados. Creó `registrations` y `mentor_profiles`, agregó la proyección privada a `candidates` y reaplicó reglas e índices sin eliminar datos. La consulta anónima de `registrations` devolvió un conjunto vacío, comportamiento con el que PocketBase oculta registros cuando la regla de listado no se cumple; las reglas persistidas limitan lectura a administradores o a la cuenta técnica. API Batch continúa habilitada.

El 2 de septiembre de 2026 se aplicaron los campos e índice de revisión, el backfill informó cero certificados existentes y su segunda ejecución confirmó idempotencia. La aceptación detectó y corrigió aditivamente la ausencia de `created`/`updated` en la colección documental; después cubrió el ciclo completo con un PDF ficticio y restauró la línea base sin residuos E2E.

El 2 de septiembre de 2026 también se desplegó de forma aditiva el portal de participantes: `users.registration`, los metadatos de autogestión y las colecciones `mentor_invitations` y `team_mentorships`. El MCP confirmó las quince colecciones requeridas, sin campos faltantes, y reglas e índices persistidos. `backfill_participant_profiles` procesó 68 inscripciones y un usuario sin producir cambios en dos ejecuciones consecutivas, confirmando idempotencia. La aceptación controlada ejercitó estudiante, docente, administrador y dos equipos competidores; PocketBase rechazó ambas violaciones directas de exclusividad, el informe mantuvo mentor separado de integrantes y FTCA, y la limpieza restauró los conteos y `dataVersion` de la línea base sin residuos E2E.
