## 1. Preparación técnica

- [x] 1.1 Documentar la topología local/producción, la separación entre Next.js y PocketBase, la aplicación explícita de esquema mediante MCP y el procedimiento de backup; verificar la copia descargada sin introducir staging.
- [x] 1.2 Releer las guías pertinentes de Next.js 16 para Route Handlers, autenticación y seguridad de datos antes de trasladar los comandos; verificar que las decisiones queden anotadas en la documentación técnica.
- [x] 1.3 Agregar y fijar las dependencias para PocketBase, validación, CSV, Excel y fechas con zona horaria; verificar que la instalación, `npm run lint` y `npm run build` finalicen correctamente.
- [x] 1.4 Definir y validar las variables públicas de PocketBase y las credenciales privadas de la cuenta técnica, sin incluir secretos ni credenciales `_superusers` en el repositorio; verificar errores accionables ante valores faltantes.
- [x] 1.5 Establecer la infraestructura de pruebas unitarias, de integración y E2E necesaria para el cambio; verificar ejecutando una prueba mínima de cada nivel configurado.

## 2. Esquema y seguridad de PocketBase

- [x] 2.1 Mantener una definición versionada del esquema esperado, incluyendo `service_accounts` y `dataVersion`, y un procedimiento idempotente para aplicarlo mediante MCP; verificar el esquema resultante en producción sin ejecutar migraciones durante un push.
- [x] 2.2 Agregar índices únicos para email y nombre normalizados, membresía única por candidato e invitaciones pendientes relevantes; verificar con pruebas que PocketBase rechace duplicados y carreras incompatibles.
- [x] 2.3 Configurar API Rules de mínimo privilegio para que las escrituras gobernadas acepten solamente la cuenta técnica y la `authRule` de `users` autorice emails presentes en padrón o allowlist; verificar tokens anónimo, candidato, administrador, técnico y superusuario.
- [x] 2.4 Reemplazar los hooks de Google OAuth por la regla de autorización y el Route Handler `/api/lomaton/auth/bootstrap`; verificar accesos de candidato, administrador, identidad mixta y email no autorizado.
- [x] 2.5 Implementar una forma segura y reproducible de cargar los emails administradores iniciales; verificar que no se requieran credenciales `_superusers` en tiempo de ejecución.
- [x] 2.6 Implementar el registro inmutable de auditoría desde Route Handlers mediante la cuenta técnica; verificar que pueda crear registros pero que ningún usuario o cuenta técnica pueda editarlos ni eliminarlos.
- [x] 2.7 Validar de forma no destructiva los cambios MCP contra el esquema de producción respaldado y documentar rollback por despliegue anterior o restauración evaluada del backup, sin depender de staging ni de migraciones `down`.
- [x] 2.8 Extender mediante MCP el esquema esperado con `registrations`, `mentor_profiles` y la relación privada hacia `candidates`, incluyendo índices de identidad y reglas de mínimo privilegio; verificar que candidatos anónimos o autenticados no puedan leer DNI, teléfono, consentimientos ni respuestas académicas.

## 3. Comandos de dominio para equipos

- [x] 3.1 Implementar Route Handlers de Next.js para crear y disolver equipos y enviar o retirar invitaciones mediante la API Batch; verificar autorización, plazo, unicidad y disponibilidad.
- [x] 3.2 Implementar Route Handlers para aceptar y rechazar invitaciones en un lote transaccional; verificar que aceptar cree una sola membresía y cancele las restantes invitaciones pendientes.
- [x] 3.3 Implementar restricciones transaccionales de un equipo por candidato y máximo cuatro miembros mediante índices y actualización condicional de contadores; verificar carreras concurrentes.
- [x] 3.4 Implementar el recálculo de `draft`, `missing_ftca`, `complete` e `invalid` dentro de los lotes que cambian membresía o FTCA; verificar todos los escenarios.
- [x] 3.5 Implementar Route Handlers administrativos para crear, renombrar, reorganizar y disolver equipos y resolver invitaciones; verificar restricciones y motivo posterior al cierre.
- [x] 3.6 Implementar una ruta de reconciliación de estados mediante lotes acotados; verificar que detecte y corrija una proyección preparada como inconsistente.

## 4. Acceso con Google y sesión web

- [x] 4.1 Crear el cliente PocketBase para navegador sin compartir estado de autenticación entre solicitudes de servidor; verificar aislamiento mediante pruebas de dos sesiones independientes.
- [ ] 4.2 Implementar la pantalla de inicio con Google y el flujo OAuth2 de PocketBase; verificar login, cancelación, error del proveedor y cierre de sesión.
- [x] 4.3 Incorporar la ayuda para usar un correo no Gmail con una cuenta Google y el enlace oficial; verificar que sea accesible antes de iniciar sesión.
- [ ] 4.4 Integrar el bootstrap posterior a OAuth, refrescar identidad y permisos de candidato/administrador y proteger las áreas correspondientes; verificar que cada rol vea solamente rutas y acciones autorizadas.
- [x] 4.5 Configurar una política CSP y medidas contra XSS acordes al almacenamiento del token en el navegador; verificar encabezados y ejecutar pruebas con contenido importado no confiable.

## 5. Padrón e importaciones

- [x] 5.1 Implementar normalización y validación compartida de nombre, apellido, email y estado FTCA, incluyendo aliases configurables de columnas; verificar con pruebas de emails, encabezados y valores FTCA variados.
- [x] 5.2 Implementar el análisis de CSV y Excel con límites configurables de tamaño y filas; verificar archivos válidos, corruptos, vacíos y que excedan límites.
- [x] 5.3 Crear el Route Handler y la interfaz de previsualización que separan filas válidas, inválidas y pendientes de FTCA; verificar que cancelar no escriba datos.
- [x] 5.4 Implementar el adaptador de encabezados y ramas reales de Google Forms, conservando nombre completo y valores de origen; verificar estudiantes FTYCA, el valor histórico `Estudiante`, estudiantes externos, docentes y respuestas con ramas contradictorias.
- [x] 5.5 Implementar normalización y deduplicación conjunta por email y DNI, selección propuesta de la respuesta más reciente, comparación de cambios y bloqueo de identidades incompatibles; verificar reenvíos idénticos, modificados y conflictos cruzados.
- [x] 5.6 Ampliar la vista previa administrativa para mostrar clasificación, campos privados, duplicados, contradicciones y correcciones de email o vínculo con revalidación completa; verificar que cancelar no escriba datos y que ninguna fila pendiente pueda confirmarse.
- [x] 5.7 Implementar en Next.js la confirmación transaccional que haga `upsert` de `registrations` y su proyección en `candidates` o `mentor_profiles`, sin crear equipos ni eliminar personas omitidas; verificar altas, actualizaciones, docentes, resumen y auditoría.
- [x] 5.8 Adaptar la administración del padrón para consultar y corregir inscripciones privadas, perfiles de mentor, candidatos y FTCA; verificar unicidad, permisos, auditoría y recálculo del equipo afectado.
- [x] 5.9 Probar que las búsquedas y vistas de candidatos expongan solamente nombre completo, email y estado operativo permitido, mientras DNI, teléfono, datos académicos y consentimientos permanezcan restringidos a administradores.
- [x] 5.10 Crear fixtures anonimizados con la estructura de las veinte columnas del archivo real y actualizar las pruebas mixtas CSV/Excel; verificar ramas vacías válidas, duplicados, email inválido, tres contradicciones, docentes y padrón final.

## 6. Experiencia de formación de equipos

- [x] 6.1 Crear el panel del candidato con estado personal, equipo actual, invitaciones recibidas y plazo argentino; verificar sus variantes sin equipo, con invitaciones y con equipo.
- [x] 6.2 Conectar la creación de equipo con el Route Handler local y la incorporación transaccional del responsable; verificar duplicado, candidato ocupado y cierre vencido.
- [x] 6.3 Conectar búsqueda, envío y retiro de invitaciones con los Route Handlers locales; verificar privacidad y duplicados.
- [x] 6.4 Conectar aceptación y rechazo con los nuevos comandos Batch; verificar éxito, cupo agotado y membresía concurrente.
- [x] 6.5 Verificar que la interfaz refleje las proyecciones recalculadas por Next.js sin contar invitaciones como miembros, para uno a cuatro integrantes y los tres estados FTCA.
- [x] 6.6 Conectar la disolución voluntaria con el Route Handler local y conservar el bloqueo de expulsión unilateral; verificar liberación de miembros.
- [x] 6.7 Actualizar las pruebas E2E del flujo completo para la frontera Next.js/PocketBase revisada; verificar rechazo de una segunda membresía.

## 7. Administración del hackatón

- [x] 7.1 Trasladar la configuración del plazo y cierre manual al Route Handler de Next.js; verificar conversión UTC, vencimiento, reapertura y auditoría.
- [x] 7.2 Aplicar el bloqueo por hora del servidor en todos los Route Handlers de mutación de candidatos; verificar que ninguna ruta alternativa evite el cierre.
- [x] 7.3 Conectar la interfaz administrativa con los Route Handlers locales para equipos e invitaciones; verificar intervenciones normales y posteriores al cierre con motivo.
- [x] 7.4 Verificar alertas y filtros contra los estados recalculados por los nuevos comandos; comprobar que un cambio FTCA se refleje de forma consistente.
- [x] 7.5 Crear la vista de auditoría por entidad y actor; verificar orden cronológico, instantáneas anterior/posterior e inmutabilidad desde la interfaz.

## 8. Reportes y exportaciones

- [x] 8.1 Trasladar la instantánea administrativa a Next.js con lectura doble de `dataVersion`; verificar cifras y reintento ante cambios concurrentes.
- [x] 8.2 Adaptar la exportación CSV a la nueva instantánea local; verificar encabezados, Unicode, separadores, comillas y archivos sin filas.
- [x] 8.3 Adaptar la exportación Excel a la nueva instantánea local; verificar contenido, tipos de celda y apertura correcta.
- [x] 8.4 Neutralizar fórmulas en todos los campos exportados y marcar la instantánea con fecha argentina; verificar valores iniciados por `=`, `+`, `-` y `@` y cambios concurrentes durante la exportación.
- [x] 8.5 Proteger consultas y Route Handlers de reporte con validación del token de usuario y cliente técnico separado; verificar denegación sin datos parciales.

## 9. Verificación y despliegue

- [x] 9.1 Revisar accesibilidad y diseño adaptable de login, candidato y administración; verificar navegación por teclado, etiquetas, estados de foco y tamaños móviles/escritorio.
- [x] 9.2 Reejecutar pruebas de seguridad sobre la nueva frontera Next.js/PocketBase, cuenta técnica, control de acceso, IDs, archivos, XSS y carreras; verificar ausencia de cambios persistentes en casos negativos.
- [x] 9.3 Ejecutar la suite completa, `npm run lint` y `npm run build` después del traslado; verificar que finalicen sin errores ni advertencias nuevas sin justificar.
- [x] 9.4 Documentar Google OAuth2, variables de Next.js, cuenta técnica, cambios PocketBase por MCP, API Batch, backup, rollback y despliegue separado en Dokploy; verificar el procedimiento usando solamente local y producción.
- [ ] 9.5 Realizar una prueba de aceptación con padrón de muestra que cubra importación, login, equipo válido, intervención posterior al cierre y exportación; verificar cada escenario contra las especificaciones OpenSpec.
