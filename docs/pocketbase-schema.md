# Esquema y seguridad de PocketBase

## Artefactos

- `pocketbase/pb_migrations/1787994000_initial_hackathon_schema.js` crea el esquema inicial y revierte todos sus cambios.
- `pocketbase/pb_hooks/10_google_auth.pb.js` autoriza exclusivamente identidades Google cuyo email verificado esté en `candidates` o `admin_allowlist`.
- `pocketbase/pb_hooks/20_audit_immutability.pb.js` impide actualizar o borrar registros de auditoría, incluso mediante la API de superusuario.
- `pocketbase/pb_hooks/lib/auth-policy.cjs` contiene la política pura y comprobable de autorización Google.

PocketBase 0.40.1 ya crea la colección auth `users` en una base nueva. La migración la modifica de forma reversible en lugar de intentar crear una segunda colección con el mismo nombre.

## Colecciones

El esquema contiene `users`, `candidates`, `admin_allowlist`, `teams`, `team_memberships`, `team_invitations`, `hackathon_settings`, `import_batches` y `audit_logs`.

Las escrituras de dominio en padrón, equipos, membresías, invitaciones, configuración, importaciones y auditoría quedan cerradas en las API Rules. Los hooks y comandos del servidor que se implementen en las tareas siguientes serán la única vía de escritura. Las lecturas se limitan así:

- cualquier usuario autenticado puede consultar candidatos, equipos, membresías y configuración;
- una invitación es visible para su destinatario, el responsable del equipo o un administrador;
- un candidato sólo puede consultar su propio registro `users`;
- un administrador puede consultar todos los usuarios, lotes de importación y auditoría;
- `admin_allowlist` no es legible desde la API de la aplicación.

La creación de usuarios tiene una regla abierta porque PocketBase la necesita para un alta OAuth2 nueva, pero `onRecordCreateRequest` bloquea el endpoint CRUD normal. El hook especializado `onRecordAuthWithOAuth2Request` es quien valida el proveedor y el email antes de permitir que continúe el alta OAuth2.

## Índices de integridad

La base de datos aplica índices únicos para:

- email normalizado de candidato;
- email normalizado de administrador autorizado;
- candidato asociado a un usuario;
- nombre normalizado de equipo;
- una única membresía por candidato;
- un único par equipo/candidato en membresías;
- una sola invitación pendiente para el mismo equipo y candidato.

El último índice es parcial: un candidato puede tener invitaciones pendientes de equipos distintos y puede conservar el historial de invitaciones ya resueltas.

## Administrador y configuración inicial

La migración carga de forma idempotente el email `carlosacostap@tecno.unca.edu.ar` en `admin_allowlist`. No crea un `_superuser`, no almacena contraseñas y no requiere credenciales administrativas en tiempo de ejecución. Cuando ese email complete Google OAuth2, el hook establecerá `isAdmin=true`.

También se crea el registro de configuración `default`, con zona `America/Argentina/Buenos_Aires` y formación abierta. El plazo queda vacío hasta que el administrador lo configure.

## Verificación realizada

Las pruebas se ejecutaron con PocketBase 0.40.1 sobre una base limpia y sobre la copia aislada restaurada desde `baseline-empty-test.zip`.

| Comprobación | Resultado |
| --- | --- |
| Migración `up` en base limpia | aplicada |
| Migración `down` | revertida |
| Segundo `up` después del rollback | aplicada sin colecciones o índices huérfanos |
| Email normalizado duplicado | HTTP 400 |
| Nombre normalizado de equipo duplicado | HTTP 400 |
| Segunda membresía del mismo candidato | HTTP 400 |
| Segunda invitación pendiente del mismo equipo | HTTP 400 |
| Invitación pendiente del mismo candidato desde otro equipo | permitida |
| Dos membresías concurrentes para el mismo candidato | una HTTP 200, una HTTP 400, un solo registro persistido |
| Lectura anónima del padrón | lista vacía |
| Lectura de padrón por candidato | permitida |
| Lectura de auditoría por candidato | lista vacía |
| Lectura de auditoría por administrador | permitida |
| Escritura directa de equipos por candidato/administrador | HTTP 403 |
| Lectura de `admin_allowlist` por administrador de aplicación | HTTP 403 |
| Alteración o borrado de auditoría por superusuario | HTTP 400 |
| Creación CRUD directa de `users` | HTTP 403 |
| Password/OTP | deshabilitados |
| OAuth2 en `users` | habilitado; falta cargar las credenciales Google del entorno |

La política Google tiene pruebas unitarias para candidato, administrador, identidad mixta, email no autorizado y proveedor distinto de Google. El proceso 0.40.1 cargó los hooks sin errores. La prueba real contra Google se realizará cuando se configuren el Client ID y Client Secret de staging.

## Comandos de operación

Con el ejecutable en `/pocketbase/pocketbase`, los equivalentes en el contenedor son:

```text
/pocketbase/pocketbase migrate up --dir=/pocketbase/data --migrationsDir=/pocketbase/migrations --hooksDir=/pocketbase/hooks
/pocketbase/pocketbase migrate down 1 --dir=/pocketbase/data --migrationsDir=/pocketbase/migrations --hooksDir=/pocketbase/hooks
```

El servicio debe detenerse o reiniciarse después de una ejecución manual para refrescar el esquema cacheado.
