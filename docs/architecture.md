# Arquitectura de Lomatón Gestión

## Topología confirmada

Sólo existen dos contextos de ejecución de Next.js: desarrollo local y producción. Ambos usan el PocketBase de producción en `https://pb-lomaton.epixum.com`; no existe staging. Next.js y PocketBase son aplicaciones separadas en Dokploy. Un push a `main` despliega exclusivamente Next.js y nunca modifica el esquema de PocketBase.

PocketBase 0.40.1 es la fuente de verdad. Los cambios de esquema, API Rules y Settings se aplican de forma explícita mediante el MCP `pocketbase-lomaton-production`, con backup previo y eliminaciones deshabilitadas. La definición esperada está versionada en `tools/pocketbase-mcp/lomaton-schema.mjs`.

## Frontera de seguridad

El navegador usa el SDK de PocketBase sólo para Google OAuth2, conservar el token del usuario y realizar lecturas permitidas por API Rules. Toda mutación de dominio llama a un Route Handler de Next.js bajo `/api/lomaton/**` o a las rutas locales de importación/exportación.

Cada Route Handler:

1. recibe el token del usuario en `Authorization`;
2. lo valida con `users/auth-refresh` en un cliente aislado;
3. comprueba candidato o administrador;
4. crea otro cliente PocketBase y autentica la colección `service_accounts`;
5. valida entradas y estado actual;
6. envía las escrituras relacionadas mediante API Batch.

La cuenta técnica tiene `role=lomaton_server`, `active=true` y reglas de mínimo privilegio. Sus credenciales viven únicamente en `.env.local` y en las variables privadas del despliegue Next.js. El runtime no utiliza `_superusers`.

## OAuth y permisos

`users` mantiene habilitado sólo Google OAuth2. Su `authRule` exige email verificado y presencia activa en `candidates` o `admin_allowlist`. Después de OAuth, `POST /api/lomaton/auth/bootstrap` sincroniza `candidate`, `isAdmin`, `enabled` y `displayName` usando la cuenta técnica. El cliente refresca la identidad antes de mostrar áreas protegidas.

## Integridad concurrente

Los índices únicos impiden dos equipos por candidato, nombres normalizados duplicados e invitaciones pendientes duplicadas. Las incorporaciones actualizan `teams.memberCount` con una precondición `expected_member_count`; si dos solicitudes compiten por el cuarto lugar, una transacción completa falla. Cada Batch incluye membresía, invitaciones, proyección de estado y `hackathon_settings.dataVersion`.

Los reportes leen `dataVersion` antes y después de la instantánea y reintentan si hubo cambios. Importaciones, intervenciones administrativas y configuración incluyen auditoría inmutable en la misma transacción.

## Guías de Next.js 16 consultadas

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`
- `node_modules/next/dist/docs/01-app/02-guides/data-security.md`
- `node_modules/next/dist/docs/01-app/02-guides/server-and-client-boundary.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`

Las decisiones resultantes son: parámetros de rutas esperados como promesas, autenticación y autorización dentro de cada handler, módulos privados con `server-only`, validación de todo dato externo, DTOs limitados y ausencia de clientes globales con sesión de usuario.
