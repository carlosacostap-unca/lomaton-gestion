## Context

La aplicación autentica usuarios con PocketBase en el navegador, pero ejecuta las escrituras gobernadas y las lecturas privadas mediante Route Handlers de Next.js y una cuenta técnica de mínimo privilegio. `candidates` es una proyección operativa legible por usuarios autenticados, por lo que no es un lugar seguro para documentos académicos. PocketBase 0.40.1 ya tiene configurado iDrive E2 como almacenamiento S3-compatible.

PocketBase guarda en la base solamente el nombre del archivo y delega el contenido al almacenamiento configurado. Un campo de archivo protegido exige que la descarga satisfaga la regla de vista mediante un token de archivo de corta duración. Véase `specs/student-certificates/spec.md` para el contrato observable.

## Goals / Non-Goals

**Goals:**

- Mantener un único PDF vigente por candidato sin ampliar la exposición de `candidates`.
- Validar el documento en servidor antes de enviarlo a PocketBase y conservar el certificado previo ante cualquier fallo.
- Centralizar autorización, descarga y auditoría en Next.js con la cuenta técnica existente.
- Usar el backend iDrive E2 exclusivamente a través de PocketBase y permitir un despliegue aditivo mediante MCP.

**Non-Goals:**

- Analizar visualmente el contenido, verificar firmas digitales o comprobar que la constancia sea auténtica.
- Incorporar antivirus, OCR, aprobación/rechazo documental o historial de versiones.
- Cambiar automáticamente FTCA, membresías o estados de equipo.
- Exponer URLs directas permanentes de PocketBase o administrar credenciales de iDrive E2 desde Next.js.

## Decisions

### 1. Colección privada separada con un registro por candidato

Se agregará `student_certificates` con una relación obligatoria `candidate`, un campo `certificate` de archivo único y protegido, `originalName`, `sizeBytes`, `sha256` y `uploadedBy`. Un índice único sobre `candidate` impedirá más de un registro vigente por persona. Las reglas de lista, vista, creación y actualización aceptarán solamente la cuenta técnica; no habrá eliminación desde la aplicación.

El campo de archivo limitará tipos a PDF y tamaño a 10 MiB como defensa redundante. Next.js tendrá `LOMATON_CERTIFICATE_MAX_BYTES` con valor predeterminado de 10 MiB y sólo admitirá valores positivos hasta ese límite estructural, lo que permitirá endurecer el límite sin modificar el esquema.

Alternativa considerada: agregar el archivo a `candidates`. Se descarta porque esa colección se consulta para formar equipos y aumentaría el riesgo de exposición accidental de documentación privada.

Alternativa considerada: relacionar el archivo con `registrations`. Se descarta porque el acceso del candidato se vincula directamente a su proyección `candidate` y la constancia puede cargarse después de la importación.

### 2. Carga multipart gobernada por Next.js

Un Route Handler recibirá `multipart/form-data`, validará primero autenticación, candidato activo y `Content-Length` cuando esté disponible, y después comprobará nombre `.pdf`, MIME `application/pdf`, tamaño real y firma `%PDF-` en los primeros bytes. También calculará SHA-256 y normalizará el nombre original antes de incluirlo como metadato.

El proxy de Dokploy deberá limitar el cuerpo HTTP apenas por encima del máximo funcional para reducir consumo de memoria. La validación posterior a `request.formData()` seguirá siendo autoritativa porque `Content-Length` y MIME son datos controlados por el cliente.

Alternativa considerada: subir el archivo directamente desde el navegador a PocketBase. Se descarta porque requeriría permitir escrituras del usuario sobre la colección, duplicaría reglas de validación y expondría más detalles del backend.

### 3. Upsert y auditoría transaccionales

El servicio buscará el certificado vigente del candidato y construirá un Batch de PocketBase que cree o actualice el archivo, agregue `audit_logs` con metadatos anterior/posterior e incremente `hackathon_settings.dataVersion`. El contenido, el token de archivo y la URL nunca se copiarán a la auditoría.

El índice único resolverá carreras de primera carga. Si dos solicitudes observan ausencia y una creación pierde por unicidad, el comando releerá una vez el registro vigente y ejecutará la otra operación como reemplazo; dos reemplazos simultáneos conservarán un único registro con semántica de última escritura confirmada. Una falla del almacenamiento o de cualquier operación Batch revertirá el cambio y conservará el certificado anterior.

Alternativa considerada: crear una fila por versión. Se descarta porque el requisito actual necesita solamente el documento vigente y almacenar versiones aumentaría retención, costo y exposición.

### 4. Metadatos y descargas siempre a través de rutas autenticadas

Se incorporarán rutas para consultar el certificado propio, cargarlo y descargarlo, además de rutas administrativas equivalentes por candidato. Cada solicitud validará el token del usuario antes de usar un cliente técnico separado. Las respuestas de metadatos incluirán sólo nombre original saneado, tamaño y fecha de actualización.

Para descargar, Next.js obtendrá un token de archivo protegido de corta duración con la cuenta técnica, solicitará el objeto a PocketBase y transmitirá el cuerpo al cliente. La respuesta usará `Content-Type: application/pdf`, `Content-Disposition: attachment` con nombre seguro, `X-Content-Type-Options: nosniff` y `Cache-Control: private, no-store`. Un candidato nunca podrá indicar libremente el id de otro candidato en una ruta propia.

Alternativa considerada: devolver la URL protegida temporal al navegador. Aunque PocketBase lo soporta, se elige el proxy para no exponer la URL del servicio, centralizar cabeceras y mantener uniforme el control de acceso.

### 5. Integración de interfaz sin mezclar documentación con reportes

El panel del candidato mostrará una tarjeta independiente con estado, nombre, fecha, tamaño, descarga y reemplazo. El cliente enviará `FormData` sin fijar manualmente `Content-Type` y refrescará los metadatos tras completar la operación.

La búsqueda administrativa agregará disponibilidad y descarga dentro del detalle privado de la inscripción. Los snapshots y exportaciones existentes no incorporarán archivo, URL, hash ni nombre; el cambio de `dataVersion` solamente permitirá que vistas administrativas futuras detecten la mutación si corresponde.

## Risks / Trade-offs

- [Un archivo con cabecera PDF puede contener contenido malicioso] → Forzar descarga, deshabilitar detección de tipo, no previsualizar ni ejecutar contenido y documentar que la validación estructural no reemplaza un antivirus.
- [La carga multipart consume memoria antes de la validación completa] → Aplicar límite en Dokploy, rechazar `Content-Length` excesivo y mantener un máximo estructural de 10 MiB en PocketBase.
- [Una falla de iDrive E2 impide cargar o descargar] → Devolver un error genérico accionable, no modificar metadatos ni auditoría y conservar el archivo anterior cuando se trate de un reemplazo.
- [Un token protegido filtrado concede acceso temporal] → Generarlo sólo en servidor, no registrarlo, no devolverlo al navegador y usar respuestas sin caché.
- [El reemplazo elimina la versión anterior] → Mostrar confirmación explícita y conservar solamente la versión vigente, acorde con la minimización de datos definida para este cambio.

## Migration Plan

1. Confirmar un backup reciente. Por decisión operativa posterior, las escrituras y eliminaciones del MCP permanecen habilitadas.
2. Extender la definición versionada con `student_certificates`, su índice, campo protegido y reglas; aplicar el cambio aditivo y validar el esquema en producción.
3. Verificar con un PDF ficticio que PocketBase escribe en iDrive E2 y que ningún token anónimo, candidato o administrador puede leer directamente la colección o el archivo.
4. Configurar `LOMATON_CERTIFICATE_MAX_BYTES` y el límite de cuerpo del proxy sin agregar credenciales de iDrive E2 a Next.js.
5. Desplegar Next.js, probar carga, reemplazo, descarga propia, descarga administrativa, rechazos y auditoría; retirar los datos ficticios mediante MCP y conservar escrituras y eliminaciones habilitadas según la decisión explícita del operador.

Ante una falla del frontend se revertirá Next.js al commit anterior y se conservará la colección aditiva con sus archivos. Si el problema está en las reglas o el campo, se corregirá hacia adelante mediante MCP; no se eliminarán certificados reales como parte de un rollback automático.

## References

- [PocketBase: Files upload and handling](https://pocketbase.io/docs/files-handling/)
- [PocketBase: API Files](https://pocketbase.io/docs/api-files/)
- [PocketBase: Collections and file fields](https://pocketbase.io/docs/collections/#fields)
