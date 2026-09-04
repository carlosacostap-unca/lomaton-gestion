## Context

La aplicación ya concentra las mutaciones sensibles en Route Handlers de Next.js que autentican el token humano y operan PocketBase con una cuenta técnica. Los archivos privados existentes, como certificados, usan campos protegidos de PocketBase y descargas mediadas; los clientes no reciben URLs ni tokens reutilizables del storage. `hackathon_settings` posee un plazo de formación en UTC y la interfaz lo traduce a `America/Argentina/Buenos_Aires`, pero esa fecha controla un proceso distinto.

La entrega cruza persistencia, archivos multipart, autorización de tres roles, configuración, auditoría y tres superficies de interfaz. Véanse `proposal.md` para la motivación y los deltas de `team-deliverables`, `hackathon-administration`, `participant-self-service`, `admin-workspace` y `jury-evaluation` para el contrato observable.

## Goals / Non-Goals

**Goals:**

- Reutilizar la frontera servidor–PocketBase y el patrón de archivos protegidos ya desplegados.
- Hacer que cada actualización de producto, versión de entrega, estado y auditoría sea atómica.
- Mantener una autorización uniforme para metadatos, archivos y enlaces en todas las rutas.
- Evitar que una carga inválida o una escritura concurrente destruya el producto vigente.
- Permitir despliegue aditivo y rollback sin transformar equipos existentes.

**Non-Goals:**

- Alojar o transcodificar el Video, previsualizar documentos o copiar contenido de enlaces externos.
- Verificar que un enlace remoto siga disponible, sea privado o contenga el producto declarado.
- Permitir que administradores o jurados corrijan entregas en nombre de un equipo.
- Conservar un repositorio descargable de todas las versiones históricas de cada archivo; la auditoría conserva eventos y metadatos, no binarios anteriores.
- Acoplar el cierre de entrega a la formación de equipos o a la apertura y publicación de la evaluación.

## Decisions

### Un registro ancho y versionado por equipo

Se añadirá una colección privada `team_deliverables` con relación única y de borrado en cascada a `teams`. Como el catálogo tiene exactamente cinco productos, un registro por equipo evita joins, hace que la validación de completitud sea determinista y permite reemplazar el producto y actualizar estado, versión y auditoría en un solo Batch.

El registro tendrá `status` (`draft` o `finalized`), `version`, `finalizedAt`, `finalizedBy` y `created`/`updated`. Presentación y Evidencia tendrán modalidad, campo de archivo protegido y URL mutuamente excluyentes; Canvas e Informe tendrán campo de archivo protegido; Video tendrá sólo URL. Para cada archivo se conservarán nombre original sanitizado, tamaño, MIME y SHA-256 como metadatos internos. Los campos de archivo de PocketBase serán protegidos y las reglas de colección admitirán exclusivamente la cuenta técnica.

Se descarta una fila por producto porque exigiría coordinar hasta seis registros para cada finalización y haría más costosa la precondición de versión. También se descarta almacenar un JSON libre porque PocketBase no podría imponer tipos, unicidad por equipo ni protección específica de archivos.

### Plazo independiente persistido en UTC

`hackathon_settings` incorporará `deliverablesDeadlineUtc`, opcional y distinto de `deadlineUtc`. La interfaz seguirá interpretando y mostrando el valor con las utilidades de `America/Argentina/Buenos_Aires`, mientras que el servidor comparará instantes UTC usando su reloj en cada mutación. La ausencia del valor deja el período de entrega no habilitado; una fecha futura lo abre y una fecha alcanzada lo cierra.

La misma operación administrativa actualizará configuración, `dataVersion` y auditoría. Adelantar el plazo a un instante alcanzado requerirá una confirmación enviada explícitamente por el cliente. No se agregará un interruptor manual separado: extensión y cierre anticipado se expresan con la fecha, evitando dos fuentes de verdad.

### Comandos por producto y finalización explícita

La API participante expondrá lectura de la entrega propia, escritura o retiro de un único producto y finalización. Las cargas de archivo usarán `multipart/form-data`; los enlaces y la finalización usarán JSON. Cada mutación recibirá `expectedVersion`, resolverá nuevamente candidato, membresía, equipo, plazo y versión, y recién entonces construirá un Batch con entrega, auditoría y `dataVersion`.

Cambiar un producto finalizado dentro del plazo conserva el nuevo contenido pero cambia el estado a `draft` y limpia los datos de finalización. Esto hace visible que el paquete modificado requiere una nueva confirmación. Retirar un producto opcional o reemplazar archivo por enlace seguirá el mismo comando; el servidor limpiará explícitamente la modalidad anterior para no conservar dos fuentes.

Se descarta un único formulario multipart con los cinco productos porque aumentaría el riesgo de repetir archivos grandes para un cambio pequeño, dificultaría reintentos y haría menos clara la concurrencia colaborativa.

### Validación en dos fases sin lectura remota

Antes de crear el Batch, el servidor aplicará límites de `Content-Length` cuando exista y comprobará nuevamente los bytes reales. Una variable `LOMATON_DELIVERABLE_MAX_BYTES`, con valor predeterminado y tope estructural de 25 MiB por archivo, controlará el máximo. Se incorporará una dependencia server-only de detección por firmas capaz de distinguir PDF, imágenes, ZIP y contenedores Office; extensión, MIME declarado y tipo detectado deberán formar una combinación permitida para el producto. Los nombres se normalizarán sólo para descarga, sin usarlos como ruta.

Los enlaces se analizarán con `URL`, admitirán sólo HTTP(S), máximo 2.048 caracteres y rechazarán credenciales embebidas, `localhost`, nombres locales y literales de IP privadas, loopback, link-local o reservadas. La aplicación nunca realizará una solicitud al destino, lo que evita SSRF y deja explícito que no valida disponibilidad ni contenido. En la interfaz se mostrará el host y se abrirá con aislamiento de contexto.

### Proyecciones mínimas y una descarga mediada común

El dominio construirá una proyección común de producto con `kind`, `required`, `medium`, metadatos seguros y, sólo para roles autorizados, el enlace aportado. Nunca devolverá el nombre interno del archivo, hash, token o URL de PocketBase. Una ruta de descarga común identificada por equipo y producto autenticará en cada solicitud y aceptará tres políticas: integrante vigente del mismo equipo, administrador o jurado activo.

Las vistas de administración y jurado usarán endpoints de listado resumido y detalle para evitar descargar archivos o emitir tokens al listar. El panel administrativo incluirá todos los equipos, incluso sin registro de entrega. El portal de jurado también mostrará todos los equipos; no dependerá de que exista un ciclo de evaluación abierto, aunque podrá enlazar los productos desde cada tarjeta de equipo.

Se descarta entregar tokens protegidos directamente al navegador porque ampliarían la ventana de acceso después de una revocación y duplicarían decisiones de autorización entre roles.

### Integración de interfaz por rol

El portal participante incorporará una sección de entrega en la proyección del equipo, con lista fija de productos, faltantes, versión, plazo y bandera calculada `canEdit`. Cada producto se editará de manera independiente, con estados accesibles de carga y error; la finalización será una acción separada y confirmada.

Administración añadirá `/admin/entregas` al menú existente, con resumen, filtros y detalle de sólo lectura. Jurado ampliará su portal con acceso de sólo lectura a productos y una advertencia visible para borradores o contenido todavía mutable. Las tres interfaces usarán la respuesta confirmada por el servidor y recargarán ante un conflicto de versión.

### Estado derivado y auditoría sin secretos

Los estados de supervisión `sin entrega`, `borrador incompleto`, `borrador completo` y `finalizado` se derivarán del registro y de la validez/presencia de los cuatro productos obligatorios; no se persistirán como valores redundantes. La auditoría registrará clase de producto, modalidad, versión, actor y metadatos no sensibles. Para enlaces se registrará como máximo el host normalizado, nunca la URL completa; para archivos, nombre seguro, tamaño, MIME y hash pueden permanecer en la entidad pero el evento evitará contenido y tokens.

## Risks / Trade-offs

- [Un archivo Office declara un MIME genérico o intenta ocultar otro contenido] → validar firma y estructura del contenedor en el servidor, mantener una matriz explícita por producto y rechazar en vez de aceptar ambiguamente.
- [Una carga grande consume memoria en el Route Handler] → limitar en el proxy, revisar `Content-Length`, imponer 25 MiB estructurales por archivo, procesar un producto por solicitud y medir el tamaño real antes de persistir.
- [Un enlace válido apunta luego a contenido malicioso o deja de existir] → no recuperarlo desde el servidor, mostrar dominio y carácter externo, abrirlo aislado y no afirmar que fue verificado.
- [Dos integrantes editan simultáneamente] → usar `expectedVersion` sobre el registro único y responder conflicto recuperable con recarga.
- [Un cambio de plazo ocurre durante una carga] → revalidar el plazo inmediatamente antes del Batch; el servidor, no el momento de selección del archivo en el navegador, decide.
- [El jurado consulta contenido antes del cierre que cambia después] → mostrar estado, última actualización y advertencia de mutabilidad; después del plazo, la misma proyección queda estable.
- [La colección ancha dificulta añadir productos arbitrarios] → aceptar el costo porque el contrato exige exactamente cinco; un catálogo editable requeriría otro cambio de esquema y producto.
- [PocketBase o el proxy rechazan multipart antes de la validación de dominio] → documentar y probar límites coherentes de aplicación, proxy y campo de archivo con margen de encapsulado.

## Migration Plan

1. Leer las guías instaladas de Next.js 16 sobre Route Handlers, cuerpos multipart, caché y seguridad antes de editar código.
2. Añadir `deliverablesDeadlineUtc` y `team_deliverables` de forma aditiva en el esquema base y una migración reversible; desplegar primero estos cambios con reglas exclusivas para la cuenta técnica.
3. Incorporar configuración, validadores, comandos, rutas y documentación operativa. Verificar acceso técnico y rechazo de acceso directo anónimo o con tokens humanos.
4. Publicar las superficies de participante, administración y jurado. Los equipos existentes aparecerán como `sin entrega`; no hace falta backfill.
5. Ejecutar pruebas de esquema, dominio, rutas, autorización, carga y E2E, además del build y la validación OpenSpec estricta.
6. Para rollback, ocultar primero las interfaces y rutas de escritura; conservar temporalmente la colección para no perder archivos. Sólo retirar campos y colección después de exportar o confirmar que no contienen entregas necesarias.
