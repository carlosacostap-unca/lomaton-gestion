## Context

La capacidad existente conserva un único PDF protegido por candidato en `student_certificates`, usa el SHA-256 como metadato estable de la versión, canaliza cargas y descargas por Route Handlers y audita altas o reemplazos dentro de un Batch de PocketBase. El panel administrativo sólo permite consultar y descargar; no existe estado de revisión. Véanse `proposal.md` y `specs/student-certificates/spec.md`.

El estado FTCA pertenece al padrón de candidatos y participa en la proyección de equipos. La revisión documental será deliberadamente independiente: una decisión sobre el PDF no ejecutará los comandos existentes de edición del candidato ni de recalculo del equipo.

## Goals / Non-Goals

**Goals:**

- Modelar una única decisión vigente, verificable contra la versión actual del PDF.
- Mantener consistentes archivo, estado de revisión, auditoría y `dataVersion` ante decisiones y reemplazos concurrentes.
- Exponer al candidato sólo el resultado comunicable y ofrecer a administración una cola privada y filtrable.
- Migrar certificados existentes sin perder archivos ni atribuir decisiones inexistentes.

**Non-Goals:**

- Inferir o modificar FTCA, membresías o validez de equipos a partir de la revisión.
- Incorporar OCR, antivirus, firma digital, fecha de vencimiento o autenticidad automática.
- Conservar historial de PDFs, comentarios internos o múltiples rondas simultáneas de revisión.
- Incluir estado, motivo o documento en exportaciones operativas generales.

## Decisions

### 1. Estado y metadatos de revisión en el registro vigente

`student_certificates` incorporará `reviewStatus` con valores `pending`, `approved` y `rejected`, además de `reviewedBy`, `reviewedAt` y `rejectionReason`. Los tres últimos estarán vacíos en `pending`; `rejectionReason` será obligatorio sólo para `rejected` y se vaciará al aprobar. El contrato declara explícitamente los `autodate` `created` y `updated`, necesarios para mostrar la fecha de carga y ordenar la cola de forma estable en PocketBase 0.40.

La colección seguirá teniendo un único registro por candidato. Mantener la decisión junto al archivo evita una segunda colección con cardinalidad e integridad adicionales y expresa que sólo importa el resultado sobre la versión vigente. La auditoría conservará las transiciones históricas no sensibles.

Alternativa considerada: una colección de revisiones append-only. Se descarta porque el alcance no requiere historial de decisiones en la interfaz y `audit_logs` ya cubre trazabilidad.

### 2. El SHA-256 vigente será la precondición de concurrencia

La acción administrativa enviará el SHA-256 observado al descargar o consultar el documento. El servicio releerá el registro y actualizará revisión, auditoría y `hackathon_settings.dataVersion` en un único Batch condicionado por `expected_sha256`. Si el candidato reemplazó el archivo, se devolverá 409 y no se aplicará ninguna operación.

Un reintento cuya versión, estado y motivo normalizado ya coincidan será un no-op exitoso, sin auditoría duplicada ni aumento de versión. Esto permite reintentos de red seguros.

Alternativa considerada: usar solamente la fecha `updated`. Se descarta porque puede cambiar por metadatos ajenos y es menos explícita que la huella del PDF revisado.

### 3. Todo reemplazo reinicia la revisión en la misma transacción

La carga inicial establecerá `pending`. Un reemplazo actualizará el archivo y sus metadatos, vaciará `reviewedBy`, `reviewedAt` y `rejectionReason`, y registrará en la auditoría el estado anterior y el reinicio. Estas operaciones permanecerán dentro del Batch que ya gobierna el reemplazo para evitar un archivo nuevo con una aprobación heredada.

La interfaz advertirá que reemplazar un certificado aprobado descarta esa decisión. No se conservará la versión anterior del archivo.

### 4. Migración aditiva y lectura compatible durante el despliegue

El esquema versionado agregará primero los campos de revisión de forma compatible. La aplicación interpretará temporalmente un `reviewStatus` vacío como `pending`; un paso de backfill asignará `pending` a los registros existentes y después la validación de contrato exigirá el campo y sus opciones definitivas.

El procedimiento se diseñará idempotente y verificará conteos antes y después. No se alterarán archivos ni hashes durante el backfill.

Alternativa considerada: considerar aprobados los documentos existentes. Se descarta porque no existe evidencia de una decisión administrativa previa.

### 5. API y proyecciones separadas por audiencia

Los metadatos del candidato agregarán un estado comunicable y el motivo sólo en `rejected`; nunca incluirán `reviewedBy`, SHA-256 ni datos de auditoría. La administración tendrá una consulta paginada por estado y un comando de decisión sobre el certificado de un candidato. Ambos reutilizarán autenticación administrativa y el proxy privado de descarga.

La cola mostrará identidad operativa, nombre seguro, tamaño, fecha de carga y estado. Los reportes y exportaciones existentes no cambiarán.

### 6. Auditoría y separación de FTCA

Las decisiones usarán acciones `student_certificate.approve` y `student_certificate.reject`; los reemplazos que descarten una decisión incluirán el reinicio en su transición auditada. La auditoría guardará IDs, estado anterior/posterior, versión y motivo cuando corresponda, pero nunca contenido, token ni URL.

Ningún comando de revisión escribirá `candidates.ftcaStatus`, membresías o equipos. Si la organización decide cambiar FTCA, seguirá usando la edición administrativa existente, con su auditoría y recalculo propios.

## Risks / Trade-offs

- [Un administrador decide sin haber abierto realmente el PDF] → Mantener descarga disponible y confirmación explícita; el sistema garantiza versión y autorización, no atención humana.
- [Un rechazo expone información inapropiada al candidato] → Limitar y normalizar el motivo, presentarlo como texto y dejar claro en la interfaz que será visible.
- [Una carrera aplica una decisión a un archivo reemplazado] → Condicionar el Batch al SHA-256 observado y responder 409 ante cualquier cambio.
- [El despliegue encuentra registros sin estado] → Interpretar vacío como `pending`, ejecutar backfill idempotente y validar conteos antes de endurecer el contrato.
- [La cola crece y encarece las consultas] → Indexar `reviewStatus` y paginar desde el primer despliegue.

## Migration Plan

1. Confirmar backup reciente y releer las guías de Next.js 16 aplicables a Route Handlers y respuestas privadas antes de implementar.
2. Extender el esquema y contrato MCP con los campos e índice de revisión sin modificar archivos existentes.
3. Aplicar el esquema aditivo en producción, backfillear certificados existentes a `pending` y validar conteos, opciones y reglas.
4. Desplegar dominio, rutas e interfaces compatibles con valores vacíos durante la transición.
5. Ejecutar aceptación con un PDF ficticio que cubra pendiente, aprobación, rechazo, reemplazo, conflicto y separación de FTCA; limpiar únicamente los datos E2E identificados.

Para revertir Next.js se conservarán los campos aditivos y se volverá al despliegue anterior. No se eliminarán decisiones ni archivos automáticamente; una corrección de datos se hará hacia adelante y con auditoría.
