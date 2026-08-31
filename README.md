# Lomatón · Gestión de equipos

Aplicación Next.js 16 para importar el padrón del hackatón, autenticar participantes con Google, formar equipos de tres o cuatro integrantes y administrar excepciones. PocketBase 0.40.1 es la fuente de verdad para usuarios, candidatos, equipos, invitaciones, configuración y auditoría.

## Desarrollo

1. Copiar `.env.example` a `.env.local` y ajustar las URLs si se usa una instancia local.
2. Instalar dependencias con `npm install`.
3. Iniciar con `npm run dev`.
4. Abrir <http://localhost:3000>.

Comandos de verificación:

```text
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

Las pruebas que escriben en PocketBase requieren las variables `PB_INTEGRATION_URL`/`PB_INTEGRATION_ADMIN_TOKEN` o `PB_E2E_BASE_URL`/`PB_E2E_SUPERUSER_IDENTITY`/`PB_E2E_SUPERUSER_PASSWORD`; sin ellas quedan omitidas. Se ejecutan exclusivamente contra una instancia local o de staging que incluya el hook de soporte ignorado bajo `.tools/`, nunca contra producción.

## OpenSpec

El cambio activo es `gestionar-hackaton`. Para consultar o continuar su implementación:

```text
openspec status --change gestionar-hackaton
openspec instructions apply --change gestionar-hackaton
```

Los artefactos están en `openspec/changes/gestionar-hackaton/`.

## Despliegue

Consultar `docs/deployment-pocketbase.md` para backup, staging, migraciones, hooks, Google OAuth2, variables de Dokploy y rollback. No aplicar migraciones en producción sin un backup restaurado y verificado previamente.
