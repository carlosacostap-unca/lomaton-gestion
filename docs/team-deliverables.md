# Entregables de equipos

## Notas de implementación para Next.js 16

Antes de implementar el flujo se revisaron las guías instaladas en `node_modules/next/dist/docs/` para Route Handlers, la convención `route.ts` y seguridad de datos. Las decisiones aplicables son:

- Los Route Handlers usan las APIs Web `Request` y `Response`; los parámetros dinámicos llegan como `Promise`.
- `request.formData()` es la API vigente para multipart. El tamaño se comprueba primero con `Content-Length` cuando existe y luego sobre el `File`, porque el encabezado no es autoritativo.
- Las rutas autenticadas y descargas permanecen dinámicas y sin caché; se conserva `dynamic = "force-dynamic"` en el endpoint multipropósito existente.
- Los archivos se devuelven con `new Response(body, { headers })`; autorización, estado y encabezados se resuelven antes de iniciar el streaming.
- Cada Route Handler repite autenticación, autorización y validación de parámetros aunque la interfaz ya restrinja la pantalla.
- Los módulos con PocketBase o variables privadas usan `server-only`, y las respuestas se reducen a DTOs sin registros crudos, hashes, tokens o nombres internos del storage.
