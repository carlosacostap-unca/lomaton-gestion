## 1. Preparar contratos, dependencias y persistencia

- [x] 1.1 Leer las guías instaladas de Next.js 16 pertinentes a Route Handlers, `Request.formData`, límites de cuerpos, caché y respuestas de archivos, y registrar en las notas de implementación las APIs vigentes que se utilizarán.
- [x] 1.2 Definir el catálogo tipado de los cinco productos, modalidades, obligatoriedad, extensiones y MIME permitidos, estados derivados y contratos de proyección; verificar mediante pruebas unitarias el conjunto exacto y los faltantes de cada combinación.
- [x] 1.3 Incorporar una dependencia server-only de detección por firma compatible con Node 20 y la variable `LOMATON_DELIVERABLE_MAX_BYTES` con tope estructural de 25 MiB; verificar instalación bloqueada, configuración predeterminada, valores inválidos y límite máximo.
- [x] 1.4 Añadir `deliverablesDeadlineUtc` a `hackathon_settings` y crear `team_deliverables` con unicidad por equipo, versión, estado, campos mutuamente excluyentes, metadatos y archivos protegidos mediante esquema base y migración reversible; verificar índices, cascada, límites de archivo y reglas exclusivas para la cuenta técnica con las pruebas de esquema.
- [x] 1.5 Actualizar tipos y fixtures de PocketBase para configuraciones y entregas, y verificar que equipos históricos sin registro continúen proyectándose como `sin entrega` sin backfill.

## 2. Implementar validación y dominio de entregas

- [x] 2.1 Implementar la validación de archivos por producto, tamaño real, extensión, MIME, firma y estructura Office/ZIP, además de nombre seguro, SHA-256 y metadatos; verificar archivos válidos, ejecutables camuflados, combinaciones inconsistentes y rechazo sin pérdida del archivo anterior.
- [x] 2.2 Implementar la validación de enlaces HTTP(S) sin credenciales, esquemas ejecutables, hosts locales ni literales de IP privados o reservados, sin realizar solicitudes remotas; verificar límites, IPv4, IPv6, `localhost`, URLs normalizadas y casos válidos.
- [x] 2.3 Implementar la resolución de integrante, equipo, plazo y `expectedVersion` para cada mutación; verificar integrante vigente, persona ajena, estudiante sin equipo, plazo ausente, instante exacto de vencimiento y conflicto concurrente.
- [x] 2.4 Implementar lectura y proyección sanitizada de una entrega, sus cinco productos, faltantes, estado derivado y `canEdit`, sin exponer hashes, nombres internos, tokens ni URLs de storage; verificar proyecciones para participante, administración y jurado.
- [x] 2.5 Implementar alta, reemplazo y retiro atómicos de un producto, limpiando la modalidad alternativa y devolviendo una entrega finalizada a borrador; verificar los cinco contratos, idempotencia, incremento de versión, limpieza de finalización y auditoría sin secretos.
- [x] 2.6 Implementar la finalización atómica que exige los cuatro productos obligatorios válidos pero no el Video, registra actor y fecha y respeta plazo y versión; verificar finalización completa, cada faltante, repetición, edición posterior y cierre concurrente.
- [x] 2.7 Implementar listados y detalles de sólo lectura para administración y jurado que incluyan todos los equipos, incluso sin entrega, y verificar estados, faltantes, fechas, orden estable y ausencia de controles o datos de escritura.
- [x] 2.8 Implementar la recuperación privada de archivos mediante PocketBase con una autorización común por equipo y rol; verificar integrante propio, administrador, jurado activo, participante ajeno, rol revocado, producto inexistente y respuesta con nombre/MIME seguros sin token reutilizable.

## 3. Exponer rutas y configurar el plazo

- [x] 3.1 Extender el comando y formulario administrativo de configuración para guardar `deliverablesDeadlineUtc` en hora argentina sin modificar el plazo de formación, exigir confirmación al cerrar de inmediato y auditar el cambio; verificar primera configuración, extensión, adelanto y conversión de zona horaria.
- [x] 3.2 Exponer las rutas participantes para consultar la entrega propia, guardar archivo o enlace por producto, retirar un producto y finalizar; verificar cuerpos JSON y multipart, `Content-Length`, tamaño real, autenticación, autorización, conflictos y códigos de error mediante pruebas de Route Handlers.
- [x] 3.3 Exponer rutas de lista y detalle de sólo lectura para administración y jurado con su autorización específica; verificar equipos sin entrega, borrador y finalizado, y comprobar que ninguno de esos endpoints admita mutaciones.
- [x] 3.4 Exponer una ruta común de descarga por equipo y producto que reautorice cada solicitud y medie el archivo protegido; verificar streaming, encabezados de descarga, errores de almacenamiento y denegación para tokens anónimos o roles no vigentes.
- [x] 3.5 Ejecutar pruebas directas contra las reglas de PocketBase para confirmar que acceso anónimo y tokens humanos no pueden listar registros ni obtener archivos, mientras la cuenta técnica puede operar la colección y los Batch requeridos.

## 4. Construir la experiencia del equipo

- [x] 4.1 Incorporar al portal participante la tarjeta de entrega con plazo argentino, estado, versión, cuatro productos obligatorios y Video opcional; verificar equipo sin entrega, borrador, finalizado, vencido y estudiante sin equipo mediante pruebas de componente.
- [x] 4.2 Construir controles independientes de archivo o enlace según cada producto, con sustitución explícita, retiro, formatos y límite visibles y estados accesibles de carga, éxito y error; verificar cambio de modalidad, prevención de doble envío y conservación del valor previo ante fallo.
- [x] 4.3 Añadir la acción confirmada de finalizar y la advertencia de que editar una entrega finalizada la devuelve a borrador; verificar faltantes, finalización válida, recarga ante conflicto de versión y bloqueo de todos los controles al vencer.

## 5. Construir las vistas de administración y jurado

- [x] 5.1 Añadir Entregas al menú administrativo y crear `/admin/entregas` con carga aislada, resumen y filtros por sin entrega, borrador incompleto, borrador completo y finalizado; verificar navegación directa, opción activa, historial del navegador y acceso no administrativo.
- [x] 5.2 Crear el detalle administrativo de sólo lectura con los cinco productos, metadatos, faltantes, fechas y acciones seguras de enlace o descarga; verificar equipos sin productos y que la interfaz no emita URLs internas ni controles de modificación.
- [x] 5.3 Ampliar el portal del jurado con el estado y los productos de todos los equipos, independiente de la existencia de un ciclo de evaluación, y advertir sobre borradores o contenido mutable; verificar entrega finalizada, borrador, sin entrega y pérdida del rol.
- [x] 5.4 Verificar por pruebas de componentes y navegador que las tres superficies sean operables con teclado, anuncien carga y errores, mantengan foco útil y se adapten a pantallas estrechas.

## 6. Documentar, integrar y validar

- [x] 6.1 Actualizar `.env.example`, arquitectura, esquema de PocketBase y guía de despliegue con la colección, plazo, límites multipart, archivos protegidos, secuencia aditiva y rollback; verificar que no se documenten secretos ni acceso directo al storage.
- [x] 6.2 Añadir pruebas E2E que cubran dos integrantes colaborando sobre la misma entrega, los cinco productos y sus modalidades, conflicto de versión, finalización, edición y nueva finalización, vencimiento, supervisión administrativa y consulta del jurado.
- [x] 6.3 Añadir pruebas E2E negativas para archivo camuflado o sobredimensionado, enlace inseguro, participante ajeno, administrador o jurado intentando modificar y descarga después de revocar acceso; verificar que ninguna respuesta filtre hashes, tokens o URLs de PocketBase.
- [x] 6.4 Ejecutar `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` y `npm run build`, corregir regresiones y validar `incorporar-entregas-equipos` con OpenSpec en modo estricto.
