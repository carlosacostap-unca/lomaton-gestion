## 1. Preparación, esquema y migración

- [x] 1.1 Releer las guías instaladas de Next.js 16 aplicables a Route Handlers, validación de cuerpos y respuestas privadas; verificar que cualquier decisión nueva o deprecación pertinente quede reflejada en la implementación o el diseño.
- [x] 1.2 Extender la definición versionada de `student_certificates` con `reviewStatus`, `reviewedBy`, `reviewedAt`, `rejectionReason` e índice por estado; verificar mediante pruebas de contrato nombres, tipos, opciones, límites, relaciones y reglas exclusivas de la cuenta técnica.
- [x] 1.3 Incorporar al MCP un backfill idempotente que clasifique como `pending` sólo los certificados sin estado y preserve archivo, SHA-256 y metadatos; verificar cero registros, múltiples registros, segunda ejecución y conteos antes/después.
- [x] 1.4 Adaptar lecturas de transición para normalizar un estado vacío como `pending` sin aceptar otros valores inválidos; verificar compatibilidad con registros previos y rechazo de estados desconocidos.

## 2. Dominio y API de revisión

- [x] 2.1 Definir tipos, validación y proyecciones separadas para candidato y administración, incluyendo normalización y límite del motivo de rechazo; verificar que la proyección del candidato no exponga revisor, SHA-256 ni auditoría.
- [x] 2.2 Actualizar la primera carga y el reemplazo para establecer o reiniciar `pending`, limpiar metadatos de revisión y auditar el reinicio dentro del Batch existente; verificar carga inicial, reemplazo pendiente, reemplazo aprobado/rechazado y conservación completa ante fallo.
- [x] 2.3 Implementar el comando administrativo de aprobación y rechazo condicionado por el SHA-256 observado, con auditoría y aumento de `dataVersion` en un único Batch; verificar transiciones válidas, rechazo sin motivo, corrección de decisión y rollback ante error.
- [x] 2.4 Hacer idempotente el reintento de una decisión idéntica y devolver conflicto ante una versión reemplazada; verificar que el no-op no duplique auditoría ni versión y que la carrera no modifique el certificado nuevo.
- [x] 2.5 Implementar la consulta administrativa paginada y filtrable por `pending`, `approved` y `rejected`; verificar filtros, orden estable, páginas vacías y ausencia de campos privados no permitidos.
- [x] 2.6 Crear o extender Route Handlers para cola y decisión administrativa reutilizando la autenticación existente; verificar sesión ausente, candidato no administrador, administrador, certificado inexistente, payload inválido, motivo excedido y conflicto de versión.

## 3. Interfaces, privacidad y accesibilidad

- [x] 3.1 Ampliar la tarjeta del candidato con estados pendiente, aprobado y rechazado, motivo comunicable y advertencia de reinicio al reemplazar; verificar foco, teclado, lectores de pantalla y diseño móvil/escritorio.
- [x] 3.2 Incorporar una cola administrativa accesible con filtros, paginación, metadatos permitidos y descarga privada; verificar estados de carga, vacío, error, cambio de filtro y navegación al candidato.
- [x] 3.3 Agregar aprobación, rechazo con motivo visible y corrección de decisión al panel administrativo, conservando el SHA-256 sólo en memoria como precondición; verificar confirmaciones, validación, reintento idempotente y recuperación visible ante 409.
- [x] 3.4 Mantener estado, motivo, revisor, hash y ubicación fuera de búsquedas públicas y exportaciones operativas; verificar contratos HTTP y regresiones de CSV/XLSX para candidatos y equipos.

## 4. Integración, despliegue y aceptación

- [x] 4.1 Verificar mediante pruebas de integración que ninguna carga, decisión o reemplazo escriba FTCA, membresías o equipos, incluyendo candidatos pendientes, no FTCA e integrantes de equipos válidos.
- [x] 4.2 Ejecutar las suites unitarias, de contrato, integración, concurrencia, autorización, privacidad y E2E, además de `npm run typecheck`, `npm run lint` y `npm run build`; verificar que finalicen sin errores ni advertencias nuevas sin justificar.
- [x] 4.3 Documentar campos, backfill, índice, monitoreo, rollback aditivo y procedimiento de aceptación/limpieza; verificar que no se agreguen credenciales de iDrive E2 ni exposición directa de archivos.
- [ ] 4.4 Confirmar un backup reciente, aplicar en producción el esquema y backfill mediante MCP y validar conteos, reglas, opciones e índice sin modificar archivos ni SHA-256 existentes.
- [ ] 4.5 Desplegar Next.js y realizar una aceptación productiva con un PDF ficticio que cubra pendiente, aprobación, rechazo, corrección, reemplazo, conflicto y separación de FTCA; eliminar únicamente los datos E2E identificados y comprobar la línea base.
