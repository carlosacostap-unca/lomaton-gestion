# Arquitectura de Lomatón Gestión

## Frontera Next.js 16 y PocketBase

La aplicación usa Next.js 16 con App Router como interfaz web y PocketBase como backend externo. PocketBase es la fuente de verdad para usuarios, candidatos, equipos, invitaciones, configuración y auditoría.

La autenticación de PocketBase vive en el navegador porque depende de APIs de cliente, del flujo OAuth2 y del estado local del SDK. Los layouts y páginas permanecen como Server Components por defecto; solamente los providers y superficies interactivas que necesitan estado, eventos o APIs del navegador se declaran Client Components. Esta frontera evita incorporar innecesariamente toda la interfaz al bundle cliente.

Los módulos que contienen secretos o capacidades administrativas deben importar `server-only`. Ningún valor privado puede usar el prefijo `NEXT_PUBLIC_`. La URL pública de PocketBase sí será una variable `NEXT_PUBLIC_`, entendiendo que Next.js fija su valor en el bundle durante `next build`.

## Route Handlers

Los Route Handlers se reservan para operaciones de Backend for Frontend que necesitan procesamiento del lado servidor, principalmente:

- analizar y validar archivos CSV/XLSX;
- preparar descargas CSV/XLSX;
- aplicar límites de tamaño y formatos de respuesta uniformes.

Cada Route Handler es un endpoint público y debe autenticar y autorizar la solicitud antes de procesarla. Los handlers con datos de usuarios serán dinámicos y no se almacenarán en caché. Los cuerpos se validarán antes de reenviarlos a PocketBase y los errores externos se traducirán sin revelar secretos o detalles internos.

El token PocketBase llegará en el encabezado `Authorization` y se reenviará solamente durante esa solicitud. No habrá una instancia global del SDK con la sesión de un usuario en el servidor.

## Reglas de dominio

Next.js no es la autoridad final para las mutaciones de equipos. Las restricciones concurrentes se aplicarán mediante comandos y hooks de PocketBase, respaldados por índices únicos:

- un candidato puede pertenecer como máximo a un equipo;
- un equipo acepta como máximo cuatro integrantes;
- aceptar una invitación crea una membresía y cancela las demás invitaciones pendientes como una sola operación lógica;
- el plazo se evalúa con la hora del servidor;
- las intervenciones administrativas dejan auditoría.

Las validaciones de interfaz mejoran la experiencia, pero nunca sustituyen estas reglas del backend.

## Variables y despliegue

Los archivos `.env.local` no se versionan. El repositorio incluirá `.env.example` sin secretos y una validación explícita de configuración. Las variables públicas se consideran valores de build en Dokploy; si la misma imagen se promueve entre entornos, la URL pública debe establecerse antes de compilar o exponerse mediante un endpoint de configuración en tiempo de ejecución.

La instancia se publica en `https://pb-lomaton.epixum.com` y usa PocketBase 0.40.1. En Dokploy se debe fijar la imagen `adrianmusante/pocketbase:0.40.1`; no se usa `latest` para evitar actualizaciones implícitas. Los artefactos versionados `pb_migrations` y `pb_hooks` se montan respectivamente en `/pocketbase/migrations` y `/pocketbase/hooks`, mientras que `/pocketbase/data` permanece en un volumen persistente. El procedimiento operativo completo está en `docs/deployment-pocketbase.md`.

## Política de seguridad web

La aplicación enviará una Content Security Policy mediante `next.config.ts`. Para conservar páginas estáticas se utilizará inicialmente una política sin nonces, restringida a orígenes propios y al origen HTTPS/WSS de PocketBase en `connect-src`. Desarrollo podrá habilitar únicamente las excepciones que Next.js requiere, como `unsafe-eval`.

Los datos importados se renderizarán como texto de React, sin HTML inyectado. Las exportaciones neutralizarán valores que una hoja de cálculo pueda interpretar como fórmulas.

## Estrategia de pruebas

Vitest cubrirá utilidades síncronas, reglas de dominio y Client Components. Los flujos que dependen de componentes asíncronos, navegación, OAuth simulado y Route Handlers se verificarán con Playwright o pruebas de integración, siguiendo la limitación documentada de Vitest para Server Components asíncronos.

## Guías locales consultadas

- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`
- `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`
- `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`
- `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`
- `node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md`
