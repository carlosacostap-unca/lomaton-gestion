## Why

Los candidatos ya pueden presentar un certificado privado, pero la organización no dispone de un estado documental explícito para revisar lo recibido ni comunicar una decisión. Esto impide distinguir documentos pendientes, aprobados o rechazados y obliga a resolver el seguimiento por canales externos.

## What Changes

- Incorporar un ciclo de revisión para el certificado vigente con estados `pending`, `approved` y `rejected`.
- Permitir que administradores autorizados filtren certificados por estado, descarguen el documento vigente y registren una aprobación o un rechazo con motivo obligatorio.
- Mostrar al candidato el estado vigente de la revisión y, cuando corresponda, un motivo de rechazo apto para ser comunicado.
- Reiniciar la revisión a `pending` cuando el candidato reemplace el PDF, sin permitir que una decisión sobre una versión anterior se aplique al archivo nuevo.
- Auditar cada decisión y cada reinicio de revisión sin copiar el contenido del PDF ni exponer credenciales o URLs de almacenamiento.
- Mantener la revisión documental independiente del estado FTCA, la pertenencia a equipos y la validez de su composición.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `student-certificates`: agrega ciclo de revisión administrativa, visibilidad del resultado, protección ante reemplazos concurrentes y separación explícita respecto de FTCA.

## Impact

- El esquema versionado de PocketBase ampliará `student_certificates` con estado y metadatos de revisión mediante una migración aditiva.
- El dominio y los Route Handlers incorporarán consultas administrativas por estado y comandos de aprobación o rechazo con control de concurrencia.
- Las interfaces de candidato y administración mostrarán el estado documental y las acciones permitidas.
- Las pruebas cubrirán migración de certificados existentes, transiciones, reemplazos, autorización, privacidad, auditoría y ausencia de efectos sobre FTCA o equipos.
