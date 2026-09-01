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
LOMATON_CERTIFICATE_MAX_BYTES=10485760
```

`NEXT_PUBLIC_POCKETBASE_URL` se incorpora durante `next build`. Las dos variables `POCKETBASE_SERVICE_*` son privadas y no deben usar el prefijo público. No configurar credenciales `_superusers` en la aplicación Next.js.

`LOMATON_CERTIFICATE_MAX_BYTES` admite valores positivos de hasta 10 MiB; si falta usa 10 MiB. El proxy frontal de la aplicación Next.js debe aceptar multipart apenas por encima de ese valor (12 MiB es un margen operativo adecuado) y rechazar cuerpos mayores. Next.js revisa `Content-Length` antes de parsear cuando está disponible y valida nuevamente el tamaño real; no se usa `experimental.proxyClientMaxBodySize` porque la aplicación no implementa `proxy.ts` y esa opción no constituye un rechazo autoritativo.

No configurar en Next.js access keys, secretos, bucket ni endpoint de iDrive E2. `student_certificates.certificate` es un campo protegido de PocketBase; PocketBase usa su storage S3-compatible ya configurado y Next.js accede únicamente mediante la cuenta técnica y tokens protegidos breves.

## Cambios de PocketBase mediante MCP

El MCP está bloqueado a HTTPS y al host productivo. Por decisión operativa, las escrituras permanecen habilitadas; las eliminaciones permanecen bloqueadas. Para un cambio planificado:

1. crear y descargar un backup nativo desde PocketBase;
2. revisar `tools/pocketbase-mcp/lomaton-schema.mjs`;
3. comprobar que `POCKETBASE_ALLOW_WRITES=true` y `POCKETBASE_ALLOW_DELETES=false`;
4. ejecutar `apply_lomaton_schema`;
5. ejecutar `ensure_service_account` sólo si se crea o sincroniza la identidad técnica;
6. ejecutar `validate_hackathon_schema` y `get_batch_settings`;
7. verificar nuevamente que las eliminaciones continúen deshabilitadas.

Para habilitar certificados, `apply_lomaton_schema` crea aditivamente `student_certificates` con un único registro por candidato, PDF protegido de hasta 10 MiB y reglas exclusivas para `lomaton_server`. Después se debe comprobar que el acceso anónimo y los tokens humanos de candidato o administrador reciben denegación al intentar acceder directamente a registros o archivos. Los flujos válidos pasan siempre por los Route Handlers de Next.js.

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

La colección documental es una migración aditiva: ante un rollback de Next.js se conserva cerrada y no afecta equipos. No eliminar automáticamente la colección ni certificados reales. Para una aceptación se puede cargar un PDF ficticio, comprobar carga, reemplazo y ambas descargas, habilitar eliminaciones sólo para retirar ese registro, validar la línea base y volver a `POCKETBASE_ALLOW_DELETES=false`. `POCKETBASE_ALLOW_WRITES` permanece en `true` por decisión explícita del operador.
