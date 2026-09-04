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
LOMATON_DELIVERABLE_MAX_BYTES=26214400
```

`NEXT_PUBLIC_POCKETBASE_URL` se incorpora durante `next build`. Las dos variables `POCKETBASE_SERVICE_*` son privadas y no deben usar el prefijo público. No configurar credenciales `_superusers` en la aplicación Next.js.

`LOMATON_CERTIFICATE_MAX_BYTES` admite valores positivos de hasta 10 MiB; si falta usa 10 MiB. El proxy frontal de la aplicación Next.js debe aceptar multipart apenas por encima de ese valor (12 MiB es un margen operativo adecuado) y rechazar cuerpos mayores. Next.js revisa `Content-Length` antes de parsear cuando está disponible y valida nuevamente el tamaño real; no se usa `experimental.proxyClientMaxBodySize` porque la aplicación no implementa `proxy.ts` y esa opción no constituye un rechazo autoritativo.

`LOMATON_DELIVERABLE_MAX_BYTES` admite valores positivos de hasta 25 MiB y usa ese máximo si falta. El proxy frontal debe aceptar multipart con al menos 1 MiB adicional de margen. Next.js rechaza primero un `Content-Length` excesivo y, aun sin ese encabezado, valida el tamaño real, la extensión, el MIME y la firma antes de enviar el archivo protegido a PocketBase.

No configurar en Next.js access keys, secretos, bucket ni endpoint de iDrive E2. `student_certificates.certificate` es un campo protegido de PocketBase; PocketBase usa su storage S3-compatible ya configurado y Next.js accede únicamente mediante la cuenta técnica y tokens protegidos breves.

## Cambios de PocketBase mediante MCP

El MCP está bloqueado a HTTPS y al host productivo. Por decisión operativa explícita, las escrituras y eliminaciones permanecen habilitadas. Para un cambio planificado:

1. crear y descargar un backup nativo desde PocketBase;
2. revisar `tools/pocketbase-mcp/lomaton-schema.mjs`;
3. comprobar que `POCKETBASE_ALLOW_WRITES=true` y `POCKETBASE_ALLOW_DELETES=true`;
4. ejecutar `apply_lomaton_schema`;
5. para el portal por rol, ejecutar `backfill_participant_profiles` dos veces y comprobar que la segunda informa `updated=0`;
6. ejecutar `ensure_service_account` sólo si se crea o sincroniza la identidad técnica;
7. ejecutar `validate_hackathon_schema` y `get_batch_settings`;
8. revisar reglas e índices de `users`, `registrations`, `mentor_invitations` y `team_mentorships` antes de desplegar Next.js;
9. revisar los objetivos exactos antes de cualquier eliminación, ya que el MCP conserva ese permiso.

Para habilitar certificados, `apply_lomaton_schema` crea aditivamente `student_certificates` con un único registro por candidato, PDF protegido de hasta 10 MiB y reglas exclusivas para `lomaton_server`. Después se debe comprobar que el acceso anónimo y los tokens humanos de candidato o administrador reciben denegación al intentar acceder directamente a registros o archivos. Los flujos válidos pasan siempre por los Route Handlers de Next.js.

Para habilitar jurados, la misma operación crea aditivamente `jurors`, `evaluation_cycles`, `jury_evaluations` y `evaluation_results`, agrega la relación opcional y única de usuario a jurado y amplía la regla de autenticación. Antes de desplegar Next.js se deben validar los cuatro índices de unicidad, las reglas exclusivas de `lomaton_server` y que la cuenta técnica pueda ejecutar API Batch. No abrir un ciclo de prueba sobre la nómina real: la aceptación automatizada normal usa dobles de navegador; cualquier aceptación productiva debe usar datos sintéticos identificables, cancelarse o limpiarse y restaurar los conteos iniciales.

### Activación de la planilla de jurado v2

La matriz lomaton-2026-planilla-v2 requiere una ampliación aditiva antes de desplegar el código que abre ciclos nuevos. El procedimiento es:

1. descargar un backup nativo y registrar conteos de evaluation_cycles, jury_evaluations y evaluation_results;
2. comprobar que no exista un ciclo open incompatible; un ciclo v1 abierto debe completarse o cancelarse con su flujo original;
3. ejecutar apply_lomaton_schema, que añade criteriaSnapshot, aspectScores, aspectObservations, los campos racionales y las sumas consolidadas sin eliminar columnas v1;
4. ejecutar nuevamente apply_lomaton_schema y confirmar que no vuelve a añadir campos;
5. ejecutar validate_hackathon_schema, revisar las reglas exclusivas de lomaton_server y confirmar API Batch;
6. desplegar la aplicación compatible con v1/v2;
7. con datos sintéticos identificables, guardar un borrador parcial y una observación, comprobar el bloqueo por aspecto faltante, finalizar los trece aspectos, reabrir, finalizar otra vez y publicar sólo cuando todos los jurados hayan concluido;
8. verificar los cinco promedios 1–5 y el total sobre 100, comprobar que el equipo no recibe observaciones ni identidades y limpiar únicamente los registros sintéticos creados.

No ejecutar ni importar las macros de la planilla recibida. El campo visual “Desafío” no se incorpora al formulario de evaluación hasta definir su fuente y regla de carga para cada ciclo. Si todavía no se abrió ningún ciclo v2, el rollback de aplicación puede volver a la versión anterior conservando los campos aditivos. Si ya existen evaluaciones v2, no retirar los campos: restaurar una aplicación compatible o detener escrituras y recuperar el backup sólo después de evaluar la pérdida de datos posteriores.

La revisión agrega aditivamente `reviewStatus` (`pending`, `approved`, `rejected`), `reviewedBy`, `reviewedAt` y `rejectionReason` (máximo 1.000 caracteres), los `autodate` explícitos `created`/`updated` y `idx_student_certificates_review_status`. Tras aplicar el esquema, ejecutar `backfill_student_certificate_reviews`: sólo asigna `pending` cuando el estado está vacío, rechaza valores desconocidos y comprueba que archivo, SHA-256, nombre original y tamaño no cambien. Una segunda ejecución debe informar cero actualizaciones.

Monitorear errores `invalid_certificate_review_status`, `certificate_review_conflict` y fallos de Batch. Un 409 es recuperable: el administrador debe releer el PDF vigente. La cola pendiente incluye temporalmente estados vacíos hasta completar el backfill. No usar FTCA, membresías ni equipos para derivar o almacenar decisiones documentales.

La aplicación idempotente crea o actualiza solamente elementos conocidos. No elimina colecciones, campos ni registros. Batch está configurado con 11.000 solicitudes, 60 segundos y 16 MiB para cubrir una importación máxima y sus proyecciones.

El rollout del portal debe mantener este orden: backup; esquema aditivo; backfill de versiones y vínculos; segunda ejecución idempotente; validación estricta; pruebas de privacidad con token humano; y sólo entonces despliegue de Next.js. La versión anterior de la aplicación ignora los campos y colecciones nuevas. No desplegar las rutas nuevas antes del esquema porque el bootstrap docente depende de `users.registration` y `mentor_profiles`.

La aceptación del portal usa datos ficticios identificables: estudiantes, docentes elegibles, dos equipos responsables y un administrador. Antes del despliegue, verificar que la transición canceló todas las invitaciones de mentoría pendientes y conservó su historial. Comprobar que el administrador puede asignar el mismo docente a ambos equipos, reemplazar o retirar cada mentoría sin alterar las otras, que cada equipo conserva como máximo un mentor, que los contadores y FTCA no cambian y que los CSV/XLSX muestran la mentoría vigente y el historial de invitaciones en columnas separadas. Eliminar sólo los registros E2E creados y repetir los conteos de línea base.

### Activación de entregas por equipo

1. Descargar un backup nativo y registrar conteos de equipos, entregas y `dataVersion`.
2. Ejecutar `apply_lomaton_schema`; debe añadir `deliverablesDeadlineUtc`, crear o completar `team_deliverables`, preservar equipos históricos sin backfill y elevar API Batch a 30 MiB.
3. Ejecutar nuevamente la aplicación y confirmar idempotencia con `validate_hackathon_schema` y `get_batch_settings`.
4. Comprobar directamente que acceso anónimo y tokens humanos no puedan listar/ver registros ni descargar archivos, y que la cuenta técnica sí pueda listar y ejecutar los Batch requeridos.
5. Configurar el plazo de entregas desde Administración en hora argentina. Un plazo pasado requiere confirmación explícita; no reutilizar ni alterar el plazo de formación.
6. Desplegar Next.js y probar con un equipo sintético: las cinco modalidades, conflicto de versión, finalización, edición posterior, nueva finalización y cierre por plazo; luego eliminar sólo los datos sintéticos identificados.

Los archivos se descargan únicamente mediante `/api/lomaton/deliverables/{teamId}/files/{producto}`. No publicar URLs de PocketBase ni tokens protegidos y no configurar credenciales del storage en Next.js.

## Google OAuth2

En Google Cloud, el cliente es de tipo Web application. La URI de redirección debe ser exactamente:

```text
https://pb-lomaton.epixum.com/api/oauth2-redirect
```

En PocketBase, `users` conserva habilitado Google y deshabilitados password y OTP. El Client ID y Client Secret se gestionan en PocketBase, nunca en el repositorio ni en Next.js. Probar acceso con el email exacto del padrón/allowlist, cancelación, email ajeno y cierre de sesión.

## Despliegue y rollback

Antes de enviar a `main`, ejecutar `npm run typecheck`, `npm run lint`, `npm test` y `npm run build`. El push despliega Next.js; PocketBase permanece intacto.

Para revertir código, seleccionar el despliegue anterior de Next.js o revertir el commit. Para un problema de esquema, detener escrituras, evaluar el alcance y restaurar el backup sólo si la corrección aditiva no es segura. Restaurar PocketBase reemplaza datos posteriores al backup, por lo que no es el primer mecanismo de rollback.

La incorporación de entregas es aditiva. Ante rollback de Next.js, conservar `team_deliverables` y `deliverablesDeadlineUtc`; la versión anterior los ignora. Si aún no existen entregas reales, una restauración del backup puede retirar el esquema, pero sólo después de detener escrituras y aceptar la pérdida de datos posteriores. Con entregas reales, el rollback seguro es restaurar una aplicación compatible o aplicar una corrección aditiva, nunca eliminar automáticamente la colección ni sus archivos.

La colección documental y sus campos de revisión son una migración aditiva: ante un rollback de Next.js se conservan cerrados y no afectan equipos. La versión anterior ignora los campos nuevos; una corrección aditiva es el rollback preferido. No quitar el índice, los campos ni certificados reales automáticamente. Restaurar el backup sólo después de detener escrituras y aceptar la pérdida de datos posteriores.

Para aceptación productiva, usar un candidato y PDF ficticios identificables; registrar línea base de certificados, equipos y membresías; comprobar pendiente, aprobación, rechazo con motivo, corrección, reemplazo que reinicia a pendiente, conflicto con una versión anterior y ambas descargas. Eliminar únicamente el registro/archivo E2E identificado y sus datos ficticios relacionados, nunca registros reales; repetir los conteos de línea base y verificar que FTCA, equipos y membresías no variaron. `POCKETBASE_ALLOW_WRITES` y `POCKETBASE_ALLOW_DELETES` permanecen en `true` por decisión explícita del operador.
