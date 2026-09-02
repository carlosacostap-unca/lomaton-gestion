# Lomatón · Gestión de equipos

Aplicación Next.js 16 para importar el padrón del hackatón, autenticar participantes con Google, formar equipos de tres o cuatro integrantes y administrar excepciones. PocketBase 0.40.1 es la fuente de verdad para usuarios, candidatos, equipos, invitaciones, configuración y auditoría.

## Desarrollo

1. Copiar `.env.example` a `.env.local`. El desarrollo local usa el PocketBase de producción confirmado.
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

Las pruebas externas que podrían escribir datos quedan omitidas salvo configuración y autorización explícitas. La suite normal usa utilidades puras y dobles de prueba; no modifica PocketBase.

## OpenSpec

El cambio activo es `revisar-certificados-alumno-regular`. Para consultar o continuar su implementación:

```text
openspec status --change revisar-certificados-alumno-regular
openspec instructions apply --change revisar-certificados-alumno-regular
```

Los artefactos están en `openspec/changes/revisar-certificados-alumno-regular/`.

## Despliegue

Consultar `docs/deployment-pocketbase.md` para backup, MCP, Google OAuth2, variables de Dokploy y rollback. Un push a `main` despliega solamente Next.js; el esquema de PocketBase cambia exclusivamente mediante una operación MCP explícita.
