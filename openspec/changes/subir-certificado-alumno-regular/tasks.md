## 1. Preparación y esquema

- [x] 1.1 Releer las guías de Next.js 16 pertinentes a Route Handlers, `FormData`, límites de cuerpos y respuestas en streaming; verificar que las decisiones aplicables queden reflejadas en la implementación o documentación técnica.
- [x] 1.2 Incorporar `LOMATON_CERTIFICATE_MAX_BYTES` a la configuración privada con valor predeterminado de 10 MiB y tope estructural equivalente; verificar valores válidos, ausentes, negativos y superiores al máximo mediante pruebas unitarias.
- [x] 1.3 Extender la definición versionada de PocketBase con `student_certificates`, archivo PDF único y protegido, metadatos, índice único y reglas exclusivas para la cuenta técnica; verificar el esquema esperado con las pruebas de contrato del MCP.
- [ ] 1.4 Aplicar aditivamente la colección en producción mediante MCP después de confirmar el backup y validar que los tokens anónimo, candidato y administrador no puedan leer ni escribir directamente registros o archivos protegidos.

## 2. Dominio y API de certificados

- [x] 2.1 Implementar la validación compartida de nombre, extensión, MIME, tamaño, firma `%PDF-`, nombre seguro y SHA-256; verificar PDFs válidos, archivos renombrados, MIME incorrecto, vacíos y excedidos.
- [x] 2.2 Implementar la consulta de metadatos y el alta o reemplazo transaccional con auditoría y aumento de `dataVersion`; verificar primera carga, reemplazo, conservación ante fallo y ausencia de contenido, token o URL en auditoría.
- [x] 2.3 Resolver carreras de primera carga y reemplazos concurrentes respetando un único registro por candidato; verificar solicitudes simultáneas contra el índice único y una proyección final coherente.
- [x] 2.4 Implementar la descarga privada mediante token protegido generado por la cuenta técnica y proxy de Next.js; verificar contenido idéntico y cabeceras `Content-Type`, `Content-Disposition`, `nosniff` y `private, no-store`.
- [x] 2.5 Crear Route Handlers para metadatos, carga y descarga del candidato actual y para consulta y descarga administrativa; verificar sesión ausente, usuario sin candidato, candidato inactivo, propietario, otro candidato, administrador y errores de almacenamiento.
- [x] 2.6 Adaptar el cliente HTTP del navegador para enviar `FormData` y descargar blobs autenticados sin fijar manualmente el límite multipart; verificar que las llamadas JSON existentes continúen funcionando.

## 3. Interfaces y privacidad

- [x] 3.1 Incorporar al panel del candidato una tarjeta accesible con estado vacío, metadatos, selección PDF, progreso ocupado, mensajes de error, descarga y confirmación de reemplazo; verificar teclado, foco y diseño móvil/escritorio.
- [x] 3.2 Incorporar disponibilidad, metadatos y descarga del certificado al detalle administrativo privado del candidato; verificar que docentes y candidatos sin documento presenten el estado correcto.
- [x] 3.3 Mantener certificados, nombres internos, hashes y ubicaciones fuera de búsquedas operativas, snapshots y exportaciones; verificar respuestas y archivos CSV/XLSX para candidatos y equipos.
- [x] 3.4 Verificar que cargar o reemplazar un certificado no cambie FTCA, membresías ni estado de equipo mediante pruebas de integración con un candidato pendiente y otro incorporado.

## 4. Verificación y despliegue

- [x] 4.1 Documentar el límite de carga de Next.js y Dokploy, la colección protegida, el uso indirecto de iDrive E2, el procedimiento MCP y el rollback aditivo; verificar que no se agreguen credenciales del storage al entorno de Next.js.
- [x] 4.2 Ejecutar pruebas unitarias, integración, E2E, privacidad y carreras, además de `npm run lint` y `npm run build`; verificar que finalicen sin errores ni advertencias nuevas sin justificar.
- [ ] 4.3 Desplegar Next.js y realizar en producción una aceptación con un PDF ficticio que cubra carga, reemplazo, descarga propia, descarga administrativa y rechazos; verificar que el objeto se almacene mediante PocketBase/iDrive E2.
- [ ] 4.4 Eliminar mediante MCP el certificado ficticio y sus datos de prueba, comprobar la línea base, volver a deshabilitar eliminaciones y conservar escrituras habilitadas según la decisión operativa explícita.
