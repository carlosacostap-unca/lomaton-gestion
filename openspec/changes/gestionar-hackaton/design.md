## Context

El repositorio contiene una aplicación mínima con Next.js 16 App Router, React 19 y TypeScript. Todavía no existe integración de datos ni autenticación. PocketBase ya está desplegado en un VPS mediante Dokploy y será un servicio externo a la aplicación Next.js.

PocketBase está orientado principalmente al consumo de sus APIs desde el cliente y advierte sobre la complejidad de combinar su autenticación con SSR en metaframeworks. Además, sus reglas de API controlan acceso y filtrado, pero las invariantes concurrentes de membresía requieren una frontera transaccional más fuerte. La solución debe mantener las credenciales de superusuario fuera del navegador y evitar que las reglas críticas dependan solamente de la interfaz.

## Goals / Non-Goals

**Goals:**

- Integrar Next.js con la instancia PocketBase existente sin acoplar la sesión del usuario al renderizado SSR.
- Hacer que PocketBase sea la fuente de verdad para identidades, padrón, equipos, invitaciones, configuración y auditoría.
- Garantizar de forma atómica un único equipo por candidato, un máximo de cuatro miembros y transiciones consistentes de invitaciones.
- Versionar el esquema y la lógica de PocketBase para que el despliegue en Dokploy sea reproducible.
- Mantener operaciones privilegiadas y secretos fuera del navegador.

**Non-Goals:**

- Gestionar la inscripción original al hackatón; el sistema recibe ese padrón mediante importación.
- Proveer autenticación local con contraseña o recuperar contraseñas.
- Reemplazar la administración de infraestructura, copias de seguridad o actualizaciones de PocketBase en el VPS.
- Automatizar comunicaciones por correo, mensajería o notificaciones push en esta primera versión.
- Implementar múltiples hackatones simultáneos; la primera versión administra una única edición activa.

## Decisions

### 1. PocketBase como backend externo y Next.js como aplicación web

La interfaz utilizará el SDK oficial de PocketBase en el navegador para la autenticación y las lecturas permitidas. Las páginas autenticadas se comportarán como cliente después de una carga inicial de Next.js, evitando depender de una sesión PocketBase compartida durante SSR.

Las operaciones que requieren procesamiento de archivos usarán Route Handlers de Next.js como adaptadores: recibirán el archivo y el token PocketBase del administrador, validarán el token, parsearán CSV/Excel y enviarán datos normalizados a una operación autoritativa de PocketBase. Ningún Route Handler conservará un cliente global con sesión de usuario.

Alternativa considerada: autenticar completamente desde Server Components mediante cookies. Se descarta para la primera versión por la complejidad y los riesgos de compartir estado señalados por PocketBase para integraciones SSR.

### 2. Google OAuth2 administrado por una colección de autenticación PocketBase

Se creará una colección auth `users` con Google como único proveedor habilitado. La aplicación iniciará el flujo OAuth2 recomendado por PocketBase y el callback registrado en Google apuntará al endpoint público `/api/oauth2-redirect` de PocketBase.

Un hook de creación/vinculación validará el email normalizado antes de conceder una identidad utilizable: deberá coincidir con `candidates.email_normalized`, con una autorización administrativa o con ambas. El registro `users` tendrá una relación opcional con el candidato y una marca administrativa independiente, permitiendo que una misma identidad posea ambos permisos si fuera necesario.

Alternativa considerada: mantener una autenticación Google separada en Next.js. Se descarta porque duplicaría identidades y sesiones, mientras PocketBase ya ofrece OAuth2 y tokens para aplicar reglas de colección.

### 3. Modelo de datos relacional y restricciones redundantes

Se versionarán migraciones PocketBase para estas colecciones:

- `users` (auth): email, relación opcional a `candidates` y permiso administrativo.
- `candidates`: nombre, apellido, email original, email normalizado, estado FTCA y estado operativo.
- `teams`: nombre, nombre normalizado, candidato responsable y estado de conformación.
- `team_memberships`: relaciones a equipo y candidato, origen de incorporación y momento de alta.
- `team_invitations`: equipo, candidato invitado, emisor, estado y fechas de resolución.
- `hackathon_settings`: registro único con plazo UTC, huso horario y apertura manual.
- `import_batches`: metadatos y resumen de cada importación, sin conservar innecesariamente el archivo original.
- `audit_logs`: actor, acción, entidad, instantáneas anterior/posterior, motivo y fecha.

Los índices únicos cubrirán email normalizado, nombre de equipo normalizado, candidato en `team_memberships` y pares relevantes de invitaciones. Las restricciones de base reducen carreras incluso si una ruta cliente realiza solicitudes simultáneas.

Alternativa considerada: guardar los miembros como una relación múltiple dentro de `teams`. Se descarta porque dificulta la unicidad global por candidato, la auditoría y las operaciones concurrentes.

### 4. Comandos críticos ejecutados dentro de PocketBase

Las mutaciones de equipos e invitaciones se expondrán como rutas o hooks de negocio versionados en `pb_hooks`, en lugar de permitir escrituras directas a las colecciones relacionadas. Cada comando validará autenticación, rol, plazo, capacidad, disponibilidad y estado actual dentro de una transacción antes de escribir.

Los comandos incluirán como mínimo: crear/disolver equipo, enviar/retirar invitación, aceptar/rechazar invitación y las variantes administrativas para reorganizar miembros. Al aceptar se creará la membresía y se cancelarán las demás invitaciones pendientes del candidato como una sola operación lógica.

Alternativa considerada: validar solamente mediante API Rules y la interfaz. Se descarta porque dos aceptaciones concurrentes podrían superar límites antes de que la otra solicitud observe el cambio.

### 5. Estado de equipo derivado y persistido como proyección

La validez se calculará a partir de membresías aceptadas y el estado FTCA vigente. `teams.status` se mantendrá como una proyección para consultas (`draft`, `missing_ftca`, `complete`, `invalid`) y se recalculará dentro de los mismos comandos o hooks que cambien membresías o candidatos.

La fuente de verdad seguirá siendo la combinación de membresías y candidatos; el estado persistido permitirá listar y exportar sin reconstruir repetidamente todo el grafo. Una rutina de reconciliación verificable podrá corregir cualquier divergencia.

### 6. Plazo guardado en UTC y presentado en hora argentina

El administrador ingresará la fecha y hora en `America/Argentina/Buenos_Aires`; la aplicación la convertirá a UTC antes de persistir. Todos los comandos evaluarán el instante actual del servidor frente al UTC almacenado, no frente al reloj del navegador. La zona IANA quedará registrada para presentación y auditoría.

### 7. Autorización por reglas y comandos, sin superusuario en tiempo de ejecución

Las API Rules permitirán las lecturas mínimas necesarias y bloquearán las escrituras directas sobre membresías, invitaciones, configuración y auditoría. Los comandos personalizados comprobarán la identidad y el permiso administrativo. Las credenciales de superusuario se usarán únicamente durante migraciones y operaciones de infraestructura, nunca se enviarán al cliente ni se incluirán en variables públicas de Next.js.

La lista inicial de administradores se cargará mediante configuración o migración segura. Los administradores de la aplicación serán registros normales autenticados por Google; no serán `_superusers`, ya que PocketBase no admite OAuth2 para esa colección y sus superusuarios omiten todas las API Rules.

### 8. Importaciones en dos fases y actualización por email

El Route Handler analizará CSV/XLSX, normalizará encabezados y valores y devolverá una vista previa firmada o reproducible. Al confirmar, reenviará las filas normalizadas a un comando PocketBase que hará `upsert` por email normalizado y registrará el lote. Las filas inválidas no se aplicarán y la omisión de un candidato no provocará bajas.

No se almacenará el archivo completo salvo que aparezca un requisito posterior de archivo documental. Esto minimiza datos duplicados y riesgos de retención.

### 9. Exportaciones generadas del lado servidor

Route Handlers autenticados consultarán una instantánea administrativa y generarán CSV/XLSX. Los valores se escaparán y se neutralizarán prefijos interpretables como fórmulas por hojas de cálculo. La fecha de generación se expresará en hora argentina.

## Risks / Trade-offs

- [El despliegue actual de PocketBase podría no montar `pb_hooks` y `pb_migrations`] -> Documentar y probar el volumen o imagen Dokploy antes de aplicar el esquema; mantener backup del volumen.
- [El popup OAuth2 puede ser bloqueado por algunos navegadores] -> Iniciar el flujo directamente desde el gesto de clic y ofrecer reintento con instrucciones claras.
- [Un cambio manual desde el dashboard PocketBase puede evitar comandos de negocio] -> Restringir el uso operativo del dashboard, ejecutar reconciliación y documentar que los cambios cotidianos se hacen desde la aplicación.
- [Guardar el token en el cliente amplía el impacto de una vulnerabilidad XSS] -> Aplicar CSP estricta, evitar HTML no confiable, minimizar dependencias del cliente y limitar duración/permisos del token.
- [PocketBase continúa evolucionando antes de su versión 1.0] -> Fijar una versión compatible, validar migraciones contra esa versión y probar actualizaciones primero en staging.
- [La edición de FTCA puede invalidar equipos cerca del cierre] -> Recalcular inmediatamente, mostrar alertas administrativas y conservar auditoría.
- [Importaciones grandes pueden superar límites HTTP o memoria] -> Definir límites de tamaño y filas, procesar con validación incremental y devolver errores accionables.

## Migration Plan

1. Confirmar la versión y URL pública de PocketBase y realizar una copia de seguridad verificable del volumen del VPS.
2. Preparar una instancia de staging o una copia de datos para ensayar migraciones y hooks.
3. Configurar la aplicación OAuth2 de Google con el callback público de PocketBase y cargar sus secretos en Dokploy.
4. Aplicar migraciones aditivas, índices, reglas y hooks; cargar al menos un email administrador autorizado.
5. Desplegar Next.js con la URL pública de PocketBase y los valores de servidor requeridos.
6. Ejecutar pruebas de login, importación, concurrencia de invitaciones, plazo, intervención administrativa y exportación.
7. Habilitar el acceso a usuarios una vez validado el padrón inicial.

Ante una falla antes de habilitar usuarios, se revierte el frontend y las migraciones mediante su operación `down` o restaurando el backup. Después de comenzar a formar equipos se priorizará corregir hacia adelante; restaurar una copia requerirá validar que no se pierdan acciones posteriores.

## Open Questions

- URL y versión exacta de la instancia PocketBase desplegada.
- Emails que recibirán inicialmente permisos administrativos.
- Nombres reales de las columnas del archivo de inscripción para definir aliases de importación.
- Límites operativos esperados de tamaño de archivo y cantidad de candidatos.

## References

- [PocketBase authentication](https://pocketbase.io/docs/authentication/)
- [PocketBase API rules and filters](https://pocketbase.io/docs/api-rules-and-filters/)
- [PocketBase usage with web applications and SSR](https://pocketbase.io/docs/how-to-use/)
- [PocketBase collections](https://pocketbase.io/docs/collections/)
