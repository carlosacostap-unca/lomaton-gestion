# Operación local y producción

## Servicios

| Servicio | Responsabilidad |
| --- | --- |
| Next.js local | desarrollo; se conecta al PocketBase productivo |
| Next.js en Dokploy | frontend y Route Handlers productivos; despliegue automático desde `main` |
| PocketBase en Dokploy | aplicación separada, URL `https://pb-lomaton.epixum.com`, versión observada `0.40.1` |

No hay staging. Los archivos históricos de `pocketbase/pb_hooks` y `pocketbase/pb_migrations` no se montan ni se ejecutan en Dokploy. Un push de código no aplica cambios a PocketBase.

## Variables de Next.js

Configurar localmente y en la aplicación Next.js de Dokploy:

```dotenv
NEXT_PUBLIC_POCKETBASE_URL=https://pb-lomaton.epixum.com
POCKETBASE_URL=https://pb-lomaton.epixum.com
POCKETBASE_SERVICE_EMAIL=lomaton-server@lomaton.internal
POCKETBASE_SERVICE_PASSWORD=<mismo secreto de la cuenta técnica creada por MCP>
IMPORT_MAX_BYTES=5242880
IMPORT_MAX_ROWS=5000
```

`NEXT_PUBLIC_POCKETBASE_URL` se incorpora durante `next build`. Las dos variables `POCKETBASE_SERVICE_*` son privadas y no deben usar el prefijo público. No configurar credenciales `_superusers` en la aplicación Next.js.

## Cambios de PocketBase mediante MCP

El MCP está bloqueado a HTTPS y al host productivo. Por defecto permite sólo lecturas. Para un cambio planificado:

1. crear y descargar un backup nativo desde PocketBase;
2. revisar `tools/pocketbase-mcp/lomaton-schema.mjs`;
3. iniciar temporalmente el MCP con `POCKETBASE_ALLOW_WRITES=true` y `POCKETBASE_ALLOW_DELETES=false`;
4. ejecutar `apply_lomaton_schema`;
5. ejecutar `ensure_service_account` sólo si se crea o sincroniza la identidad técnica;
6. ejecutar `validate_hackathon_schema` y `get_batch_settings`;
7. detener la sesión con escrituras y volver al modo de sólo lectura.

La aplicación idempotente crea o actualiza solamente elementos conocidos. No elimina colecciones, campos ni registros. Batch está configurado con 11.000 solicitudes, 60 segundos y 16 MiB para cubrir una importación máxima y sus proyecciones.

## Google OAuth2

En Google Cloud, el cliente es de tipo Web application. La URI de redirección debe ser exactamente:

```text
https://pb-lomaton.epixum.com/api/oauth2-redirect
```

En PocketBase, `users` conserva habilitado Google y deshabilitados password y OTP. El Client ID y Client Secret se gestionan en PocketBase, nunca en el repositorio ni en Next.js. Probar acceso con el email exacto del padrón/allowlist, cancelación, email ajeno y cierre de sesión.

## Despliegue y rollback

Antes de enviar a `main`, ejecutar `npm run typecheck`, `npm run lint`, `npm test` y `npm run build`. El push despliega Next.js; PocketBase permanece intacto.

Para revertir código, seleccionar el despliegue anterior de Next.js o revertir el commit. Para un problema de esquema, detener escrituras, evaluar el alcance y restaurar el backup sólo si la corrección aditiva no es segura. Restaurar PocketBase reemplaza datos posteriores al backup, por lo que no es el primer mecanismo de rollback.
