## 1. Preparación técnica

- [x] 1.1 Confirmar y documentar la URL, versión, montaje de `pb_hooks`/`pb_migrations` y procedimiento de backup de la instancia PocketBase en Dokploy; verificar restaurando o inspeccionando una copia de prueba.
- [x] 1.2 Leer las guías pertinentes de Next.js 16 incluidas en `node_modules/next/dist/docs/` antes de escribir componentes, Route Handlers o configuración; verificar que las decisiones adoptadas queden anotadas en la documentación técnica del proyecto.
- [x] 1.3 Agregar y fijar las dependencias para PocketBase, validación, CSV, Excel y fechas con zona horaria; verificar que la instalación, `npm run lint` y `npm run build` finalicen correctamente.
- [x] 1.4 Definir y validar variables de entorno públicas y privadas sin incluir secretos en el repositorio; verificar que la aplicación falle con un mensaje accionable cuando falte una variable obligatoria.
- [x] 1.5 Establecer la infraestructura de pruebas unitarias, de integración y E2E necesaria para el cambio; verificar ejecutando una prueba mínima de cada nivel configurado.

## 2. Esquema y seguridad de PocketBase

- [x] 2.1 Crear migraciones versionadas para `users`, `candidates`, `teams`, `team_memberships`, `team_invitations`, `hackathon_settings`, `import_batches` y `audit_logs`; verificar el esquema resultante en una instancia PocketBase limpia.
- [x] 2.2 Agregar índices únicos para email y nombre normalizados, membresía única por candidato e invitaciones pendientes relevantes; verificar con pruebas que PocketBase rechace duplicados y carreras incompatibles.
- [x] 2.3 Configurar API Rules de mínimo privilegio y bloquear escrituras directas en colecciones gobernadas por comandos; verificar con tokens anónimo, candidato, administrador y superusuario los permisos esperados.
- [x] 2.4 Implementar hooks de Google OAuth que normalicen el email y vinculen solamente candidatos importados o administradores autorizados; verificar accesos de candidato, administrador, identidad mixta y email no autorizado.
- [x] 2.5 Implementar una forma segura y reproducible de cargar los emails administradores iniciales; verificar que no se requieran credenciales `_superusers` en tiempo de ejecución.
- [x] 2.6 Implementar el registro inmutable de auditoría para importaciones, cambios de configuración e intervenciones administrativas; verificar que la aplicación pueda leer los registros pero no editarlos ni eliminarlos.
- [x] 2.7 Probar las operaciones `up` y `down` de las migraciones contra una copia de staging y documentar el resultado; verificar que el rollback no deje colecciones o índices huérfanos.

## 3. Comandos de dominio para equipos

- [x] 3.1 Implementar comandos PocketBase para crear y disolver equipos y para enviar o retirar invitaciones; verificar autorización, plazo, unicidad del nombre y disponibilidad del candidato.
- [x] 3.2 Implementar comandos para aceptar y rechazar invitaciones dentro de una transacción; verificar que aceptar cree una sola membresía y cancele las restantes invitaciones pendientes.
- [x] 3.3 Implementar las restricciones transaccionales de un equipo por candidato y máximo cuatro miembros; verificar mediante solicitudes concurrentes que solamente una operación compatible tenga éxito.
- [x] 3.4 Implementar el recálculo de `draft`, `missing_ftca`, `complete` e `invalid` ante cambios de membresía o FTCA; verificar todos los escenarios de composición definidos en la especificación.
- [x] 3.5 Implementar comandos administrativos para crear, renombrar, reorganizar y disolver equipos y resolver invitaciones; verificar que respeten las restricciones estructurales y exijan motivo después del cierre.
- [x] 3.6 Implementar una rutina de reconciliación de estados de equipo; verificar que detecte y corrija una proyección de estado preparada deliberadamente como inconsistente.

## 4. Acceso con Google y sesión web

- [x] 4.1 Crear el cliente PocketBase para navegador sin compartir estado de autenticación entre solicitudes de servidor; verificar aislamiento mediante pruebas de dos sesiones independientes.
- [ ] 4.2 Implementar la pantalla de inicio con Google y el flujo OAuth2 de PocketBase; verificar login, cancelación, error del proveedor y cierre de sesión.
- [x] 4.3 Incorporar la ayuda para usar un correo no Gmail con una cuenta Google y el enlace oficial; verificar que sea accesible antes de iniciar sesión.
- [x] 4.4 Implementar la carga de identidad y permisos de candidato/administrador y proteger las áreas correspondientes; verificar que cada rol vea solamente las rutas y acciones autorizadas.
- [x] 4.5 Configurar una política CSP y medidas contra XSS acordes al almacenamiento del token en el navegador; verificar encabezados y ejecutar pruebas con contenido importado no confiable.

## 5. Padrón e importaciones

- [x] 5.1 Implementar normalización y validación compartida de nombre, apellido, email y estado FTCA, incluyendo aliases configurables de columnas; verificar con pruebas de emails, encabezados y valores FTCA variados.
- [x] 5.2 Implementar el análisis de CSV y Excel con límites configurables de tamaño y filas; verificar archivos válidos, corruptos, vacíos y que excedan límites.
- [x] 5.3 Crear el Route Handler y la interfaz de previsualización que separan filas válidas, inválidas y pendientes de FTCA; verificar que cancelar no escriba datos.
- [x] 5.4 Implementar la confirmación del lote y el `upsert` atómico por email normalizado sin eliminar candidatos omitidos; verificar altas, actualizaciones, duplicados y resumen de errores.
- [x] 5.5 Crear la administración del padrón para buscar y editar candidatos y su estado FTCA; verificar unicidad de email, auditoría y advertencia cuando se invalida un equipo.
- [x] 5.6 Agregar pruebas de integración de una importación mixta CSV/Excel desde vista previa hasta PocketBase; verificar que el padrón final coincida con las filas confirmadas.

## 6. Experiencia de formación de equipos

- [x] 6.1 Crear el panel del candidato con estado personal, equipo actual, invitaciones recibidas y plazo argentino; verificar sus variantes sin equipo, con invitaciones y con equipo.
- [x] 6.2 Implementar la creación de equipo con nombre único y la incorporación automática del responsable; verificar errores por nombre duplicado, candidato ocupado y cierre vencido.
- [x] 6.3 Implementar búsqueda de candidatos disponibles y envío/retiro de invitaciones por el responsable; verificar que no exponga registros no autorizados ni permita duplicados.
- [x] 6.4 Implementar aceptación y rechazo de invitaciones con actualización inmediata de las demás invitaciones; verificar éxito, cupo agotado y membresía concurrente.
- [x] 6.5 Mostrar integrantes aceptados, invitaciones pendientes y motivos de equipo incompleto o inválido sin contar invitaciones como miembros; verificar equipos de uno a cuatro integrantes y los tres estados FTCA.
- [x] 6.6 Implementar la disolución voluntaria y bloquear la expulsión unilateral de miembros aceptados; verificar que los miembros liberados queden nuevamente disponibles.
- [x] 6.7 Agregar pruebas E2E del flujo completo de varios candidatos formando un equipo válido; verificar que un segundo intento de membresía sea rechazado.

## 7. Administración del hackatón

- [x] 7.1 Crear la configuración administrativa del plazo en `America/Argentina/Buenos_Aires` y del cierre manual; verificar conversión UTC, vencimiento, reapertura y auditoría.
- [x] 7.2 Aplicar el bloqueo de operaciones de candidatos en todos los comandos de mutación; verificar usando la hora del servidor que ninguna ruta alternativa evite el cierre.
- [x] 7.3 Crear la interfaz administrativa para formar, editar, reorganizar y disolver equipos y actuar sobre invitaciones; verificar intervenciones normales y posteriores al cierre con motivo.
- [x] 7.4 Crear alertas y filtros para equipos incompletos o inválidos; verificar que un cambio FTCA se refleje sin requerir recarga manual de datos inconsistentes.
- [x] 7.5 Crear la vista de auditoría por entidad y actor; verificar orden cronológico, instantáneas anterior/posterior e inmutabilidad desde la interfaz.

## 8. Reportes y exportaciones

- [x] 8.1 Crear el tablero administrativo con cantidades y filtros de candidatos, disponibilidad y estados de equipo; verificar cifras contra datos de prueba conocidos.
- [x] 8.2 Implementar la exportación de candidatos y equipos a CSV; verificar encabezados, Unicode, separadores, comillas y archivos sin filas.
- [x] 8.3 Implementar la exportación equivalente a Excel; verificar contenido, tipos de celda y apertura correcta en una aplicación compatible.
- [x] 8.4 Neutralizar fórmulas en todos los campos exportados y marcar la instantánea con fecha argentina; verificar valores iniciados por `=`, `+`, `-` y `@` y cambios concurrentes durante la exportación.
- [x] 8.5 Proteger consultas y Route Handlers de reporte para administradores; verificar que tokens anónimos y de candidato reciban una denegación sin datos parciales.

## 9. Verificación y despliegue

- [x] 9.1 Revisar accesibilidad y diseño adaptable de login, candidato y administración; verificar navegación por teclado, etiquetas, estados de foco y tamaños móviles/escritorio.
- [x] 9.2 Ejecutar pruebas de seguridad sobre control de acceso, manipulación de IDs, archivos maliciosos, XSS y carreras de membresía; verificar que los casos negativos no produzcan cambios persistentes.
- [x] 9.3 Ejecutar la suite completa, `npm run lint` y `npm run build`; verificar que todos finalicen sin errores ni advertencias nuevas sin justificar.
- [ ] 9.4 Documentar configuración de Google OAuth2, variables de Next.js, migraciones/hooks PocketBase, backup, rollback y despliegue Dokploy; verificar el procedimiento en staging siguiendo solamente la documentación.
- [ ] 9.5 Realizar una prueba de aceptación con padrón de muestra que cubra importación, login, equipo válido, intervención posterior al cierre y exportación; verificar cada escenario contra las especificaciones OpenSpec.
