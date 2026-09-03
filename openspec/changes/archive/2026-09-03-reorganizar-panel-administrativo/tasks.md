## 1. Preparar la arquitectura administrativa

- [x] 1.1 Leer las guías locales de Next.js 16 pertinentes a layouts, navegación, Route Handlers y parámetros dinámicos antes de modificar código, y verificar que las decisiones de implementación queden alineadas con esas APIs.
- [x] 1.2 Crear el shell administrativo compartido con control de acceso, encabezado, cierre de sesión y navegación a Resumen, Equipos, Certificados, Personas, Importación y Configuración, y verificar mediante una prueba de componente que el destino activo sea perceptible y que Reportes y Auditoría no aparezcan.
- [x] 1.3 Crear las rutas `/admin`, `/admin/equipos`, `/admin/certificados`, `/admin/personas`, `/admin/importacion` y `/admin/configuracion`, migrando cada herramienta vigente a su destino, y verificar que una carga directa o recarga muestre solamente la sección solicitada.
- [x] 1.4 Implementar la variante compacta y accesible del menú para pantallas estrechas, con foco visible y operación por teclado, y verificarla con pruebas responsivas sin desplazamiento horizontal.
- [x] 1.5 Incorporar estados locales de carga, vacío, error y reintento por sección, y verificar que el fallo simulado de una consulta no bloquee la navegación hacia otra sección.
- [x] 1.6 Retirar de la página administrativa principal el montaje monolítico y los accesos visibles a Reportes y Auditoría sin eliminar sus datos, endpoints ni trazabilidad interna, y verificar que las secciones no visitadas no monten formularios ni realicen consultas.

## 2. Reorganizar la revisión de certificados

- [x] 2.1 Extraer una operación de navegador reutilizable que recupere el PDF mediante autenticación y conserve el nombre seguro de archivo, y verificar con pruebas unitarias las respuestas correctas, expiradas y denegadas.
- [x] 2.2 Implementar el visor PDF nativo con URL de objeto temporal, alternativa de error, reintento y descarga independiente, y verificar que la URL anterior se revoque al cambiar, cerrar o desmontar el certificado.
- [x] 2.3 Convertir la cola de certificados en una lista resumida con un único detalle activo que reúna metadatos, visor, descarga y decisiones, y verificar que nunca se expandan simultáneamente dos documentos.
- [x] 2.4 Reflejar estado, página y selección útil de la cola en parámetros de URL, y verificar recarga, enlace directo y navegación atrás/adelante sin perder el contexto de revisión.
- [x] 2.5 Mantener aprobación, rechazo, actualización posterior y manejo de conflictos sobre la versión visible, y verificar con pruebas que una decisión exitosa actualice la cola y que un conflicto no aplique una decisión obsoleta.
- [x] 2.6 Verificar la privacidad integral del visor y la cola con pruebas de rutas que confirmen que usuarios no administrativos no reciben listados, metadatos ni contenido PDF.

## 3. Separar listado y detalle de equipos

- [x] 3.1 Implementar una proyección administrativa mínima para listar resúmenes de equipos con nombre, estado, cantidad de integrantes, condición FTCA, mentor y advertencias, y verificar su estructura y autorización con pruebas de dominio o ruta.
- [x] 3.2 Implementar una consulta administrativa de detalle para un solo equipo con responsable, integrantes, invitaciones, mentor, candidatos elegibles y datos operativos, y verificar que no exponga información de otros equipos ni permita acceso no administrativo.
- [x] 3.3 Reemplazar el administrador expandido por un listado compacto con búsqueda, filtros y estado vacío, y verificar que los resultados coincidan por nombre y estado sin renderizar formularios de equipos no seleccionados.
- [x] 3.4 Crear `/admin/equipos/[teamId]` con el detalle y las acciones existentes de formación, miembros, invitaciones y mentoría, y verificar que cada acción siga utilizando los comandos atómicos y las reglas actuales.
- [x] 3.5 Conservar búsqueda y filtros al entrar y volver del detalle, además de foco y mensajes de resultado comprensibles, y verificar el recorrido completo mediante una prueba de navegación.
- [x] 3.6 Refrescar el detalle y su resumen después de cada operación exitosa y manejar cambios concurrentes recuperables, y verificar asignación de un mentor compartido, reemplazo, retiro y exigencia de motivo posterior al cierre.

## 4. Integración y regresión

- [x] 4.1 Añadir pruebas de integración del espacio administrativo para acceso directo, recarga, retroceso, destino desconocido y denegación por rol, y verificar que todas pasen con `npm test`.
- [x] 4.2 Añadir pruebas de extremo a extremo para navegación responsiva, revisión visual de un certificado y gestión individual de un equipo, y verificar el recorrido con `npm run test:e2e` en los navegadores configurados.
- [x] 4.3 Ejecutar `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`, y corregir cualquier regresión hasta que todos los comandos finalicen correctamente.
- [x] 4.4 Revisar manualmente en escritorio y móvil que sólo existan las seis secciones acordadas, que el PDF pueda visualizarse o descargarse y que Equipos use lista y detalle, documentando cualquier limitación específica del visor del navegador.
