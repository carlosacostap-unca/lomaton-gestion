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
- `hackathon_settings`: plazo de formación, plazo independiente de entregas (`deliverablesDeadlineUtc`), apertura, zona y `dataVersion`.
- `team_deliverables`: un agregado protegido por equipo con versión, estado, cinco productos, modalidad, metadatos seguros y archivos privados.
- `import_batches`: resumen de importaciones.
- `audit_logs`: trazabilidad inmutable.
- `student_certificates`: PDF privado por candidato y revisión administrativa independiente de FTCA/equipos.
- `jurors`: nómina evaluadora por nombre, correo normalizado único y estado activo.
- `evaluation_cycles`: ciclo abierto, cancelado o publicado con instantánea de cantidades, criteriaVersion, criteriaSnapshot y responsables.
- `jury_evaluations`: par único ciclo-jurado-equipo; conserva columnas v1 y agrega mapas JSON de puntajes/observaciones por aspecto y total racional v2.
- `evaluation_results`: agregado inmutable por ciclo y equipo; conserva sumas v1 y agrega sumas por criterio y total racional v2.

Las escrituras de dominio aceptan exclusivamente `active=true && role="lomaton_server"`. `audit_logs` permite creación técnica pero mantiene update/delete bloqueados. `admin_allowlist` sólo se modifica mediante MCP. `registrations` y `mentor_profiles` admiten lectura únicamente administrativa o técnica; DNI, teléfono, datos académicos, consentimientos y respuestas originales no existen en `candidates`. Las lecturas del navegador siguen el rol del usuario.

`team_deliverables` restringe list/view/create/update/delete a `lomaton_server`; su actualización admite `expected_version` como guardia concurrente. Los cuatro campos de archivo son `protected`, tienen máximo estructural de 25 MiB y MIME específico. El índice único `idx_team_deliverables_team` impide más de una entrega por equipo y la relación usa cascada al eliminar el equipo. Participantes, administradores y jurados nunca acceden directamente a esta colección: las lecturas y descargas pasan por Next.js.

`users.authRule` exige email verificado presente y activo en candidatos, docentes habilitados, jurados o allowlist; `createRule` limita el alta al contexto `oauth2`. Password y OTP están deshabilitados para `users`.

## Integridad

Los índices únicos cubren email y DNI normalizados de inscripción, relación inscripción/usuario, relación inscripción/candidato, relación inscripción/mentor, email de candidato, email administrativo, candidato vinculado a usuario, nombre de equipo, una membresía por candidato, par equipo/candidato e invitación pendiente por equipo/candidato. `team_mentorships` agrega unicidad independiente por equipo y por mentor; `mentor_invitations` evita duplicar el mismo par mientras esté pendiente. Las relaciones desde membresías, invitaciones y mentorías al equipo tienen `cascadeDelete=true`.

Las inscripciones aceptan actualización técnica condicionada por `expected_profile_version`. El portal expone una proyección propia por Route Handler, no la colección privada: teléfono es editable para ambos roles; estudiantes pueden mantener unidad académica, carrera y departamento; docentes pueden mantener departamento, descripción institucional e interés. Cada escritura incrementa `profileVersion`, conserva `selfManagedFields`, audita e incrementa `dataVersion` en el mismo Batch.

Un mentor nunca forma parte de `team_memberships`, no aumenta `memberCount` y no participa de `ftcaConfirmedCount`. La aceptación crea una asignación y cancela en el mismo Batch las invitaciones pendientes incompatibles; los índices únicos resuelven la última carrera concurrente.

`student_certificates` mantiene unicidad por candidato e índice por `reviewStatus`. Los estados permitidos son `pending`, `approved` y `rejected`; la relación opcional `reviewedBy` apunta a `users`, `reviewedAt` registra la decisión y `rejectionReason` se limita a 1.000 caracteres. `created` y `updated` son campos `autodate` explícitos porque PocketBase 0.40 no los agrega implícitamente a colecciones nuevas. El reemplazo del archivo limpia esos tres metadatos y vuelve a `pending`.

El máximo de cuatro se protege con una actualización condicional del contador en cada Batch. La proyección queda en `draft`, `missing_ftca`, `complete` o `invalid` según membresías y FTCA.

Las cuatro colecciones de evaluación aceptan acceso directo exclusivamente de la cuenta técnica. Sus índices garantizan un único correo de jurado, un solo ciclo abierto, un único par ciclo-jurado-equipo y un resultado por ciclo-equipo. La relación opcional de usuario a jurado también es única. Los cinco pesos son 25, 25, 20, 15 y 15 por ciento.

Para v1, un cero se distingue de un criterio todavía no completado mediante completedCriteria; scoreInnovation a scoreTeamwork y totalCentipoints no se eliminan. Para v2, aspectScores sólo admite las trece claves congeladas con enteros 1–5, aspectObservations guarda textos opcionales de hasta 1.000 caracteres, y totalNumerator/totalDenominator conservan el total exacto. Al publicar, criterionAspectScoreSums, totalNumeratorSum y totalDenominator permiten promediar todos los jurados sin sumar decimales redondeados. Las observaciones sólo integran los DTO propios del jurado y administrativos; auditorías y resultados de equipos las omiten.

## Estado aplicado

El 1 de septiembre de 2026 el MCP aplicó y validó las doce colecciones y todos los campos esperados. Creó `registrations` y `mentor_profiles`, agregó la proyección privada a `candidates` y reaplicó reglas e índices sin eliminar datos. La consulta anónima de `registrations` devolvió un conjunto vacío, comportamiento con el que PocketBase oculta registros cuando la regla de listado no se cumple; las reglas persistidas limitan lectura a administradores o a la cuenta técnica. API Batch continúa habilitada.

El 2 de septiembre de 2026 se aplicaron los campos e índice de revisión, el backfill informó cero certificados existentes y su segunda ejecución confirmó idempotencia. La aceptación detectó y corrigió aditivamente la ausencia de `created`/`updated` en la colección documental; después cubrió el ciclo completo con un PDF ficticio y restauró la línea base sin residuos E2E.

El 2 de septiembre de 2026 también se desplegó de forma aditiva el portal de participantes: `users.registration`, los metadatos de autogestión y las colecciones `mentor_invitations` y `team_mentorships`. El MCP confirmó las quince colecciones requeridas, sin campos faltantes, y reglas e índices persistidos. `backfill_participant_profiles` procesó 68 inscripciones y un usuario sin producir cambios en dos ejecuciones consecutivas, confirmando idempotencia. La aceptación controlada ejercitó estudiante, docente, administrador y dos equipos competidores; PocketBase rechazó ambas violaciones directas de exclusividad, el informe mantuvo mentor separado de integrantes y FTCA, y la limpieza restauró los conteos y `dataVersion` de la línea base sin residuos E2E.

El 3 de septiembre de 2026 se añadió de forma aditiva `teams.challenge` en producción como selección opcional restringida a los cinco identificadores oficiales. Antes del cambio se creó y descargó el backup nativo `lomaton-pre-team-challenge-20260903230343400.zip` (SHA-256 `06e386faae4341dc5198a9775f2435f87d95ef9a6a4b8d7ace042d03108e6091`). La verificación posterior confirmó el campo, sus cinco valores, los doce equipos existentes legibles y sin selección inicial, y la configuración Batch sin cambios.

El 3 de septiembre de 2026 se habilitó la matriz `lomaton-2026-planilla-v2` después de comprobar que no existían ciclos abiertos. Se creó y descargó el backup nativo `lomaton-before-jury-v2-20260903t230345481z.zip` de 2.346.232 bytes (SHA-256 `1f1e48d8351d90b2841d1e1ae64592c6d23b2e2434aa69f0fee7d0d28acb76a5`). La aplicación añadió `criteriaSnapshot`, puntajes y observaciones por aspecto y acumuladores racionales; además dejó opcionales los seis acumuladores exclusivos de v1 para que los resultados v2 no deban mezclar datos históricos. Una segunda aplicación no volvió a añadir ni modificar esos campos. La aceptación productiva aislada completó dos jurados por dos equipos, borrador parcial, observación, bloqueo por faltantes, finalización, reapertura, nueva finalización y publicación; el equipo de control recibió promedios 4,00; 4,00; 3,50; 4,33; 4,00 y total 79,00/100 sin observaciones ni identidades. La limpieza restauró a cero ciclos, evaluaciones y resultados y no dejó usuarios, candidatos, equipos ni jurados E2E. La operación global creó también la colección vacía `team_deliverables`, ya incluida por otro cambio pendiente en la definición local; no se crearon registros en ella.

La verificación de implementación de entregas confirmó que la colección productiva conserva reglas exclusivas para `lomaton_server`, archivos protegidos de 25 MiB, los índices esperados y cero registros previos. Una consulta técnica pudo listar la colección vacía y una consulta anónima directa obtuvo una lista vacía, sin metadatos ni URLs de archivo.
