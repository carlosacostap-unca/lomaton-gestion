## Context

El repositorio contiene una aplicación Next.js 16 App Router, React 19 y TypeScript con interfaces y lógica de dominio ya iniciadas. PocketBase está desplegado como una aplicación separada en Dokploy y seguirá siendo un servicio externo a la aplicación Next.js.

La aplicación PocketBase de producción no se reconstruye ni se actualiza ante cada push del repositorio. El esquema y la configuración se administran mediante operaciones MCP explícitas y auditables. La lógica autoritativa se despliega con Next.js y usa las APIs de PocketBase con una identidad técnica limitada; las invariantes concurrentes se preservan mediante índices, contadores y la API Batch transaccional.

## Goals / Non-Goals

**Goals:**

- Integrar Next.js con la instancia PocketBase existente sin acoplar la sesión del usuario al renderizado SSR.
- Hacer que PocketBase sea la fuente de verdad para identidades, padrón, equipos, invitaciones, configuración y auditoría.
- Garantizar de forma atómica un único equipo por candidato, un máximo de cuatro miembros y transiciones consistentes de invitaciones.
- Mantener una definición versionada del esquema esperado y aplicar sus cambios explícitamente mediante MCP, sin acoplarla al despliegue de Next.js.
- Ejecutar la lógica de negocio autoritativa en Route Handlers de Next.js y conservar las escrituras compuestas como transacciones PocketBase.
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

Todas las operaciones de negocio usarán Route Handlers de Next.js. Cada handler recibirá el token PocketBase del usuario, lo validará mediante `auth-refresh`, comprobará el rol y ejecutará lecturas o escrituras con un cliente técnico independiente. Los handlers de importación también parsearán CSV/Excel y validarán sus límites. Ningún Route Handler conservará un cliente global con sesión de usuario.

Los componentes del navegador llamarán rutas locales `/api/lomaton/**` de Next.js; no llamarán rutas personalizadas de PocketBase. Las lecturas directas permitidas por API Rules podrán seguir usando el SDK de navegador cuando no alteren invariantes.

Alternativa considerada: autenticar completamente desde Server Components mediante cookies. Se descarta para la primera versión por la complejidad y los riesgos de compartir estado señalados por PocketBase para integraciones SSR.

### 2. Google OAuth2 administrado por una colección de autenticación PocketBase

La colección auth `users` tendrá Google como único proveedor habilitado. La aplicación iniciará el flujo OAuth2 recomendado por PocketBase y el callback registrado en Google apuntará al endpoint público `/api/oauth2-redirect` de PocketBase.

La `authRule` de `users` comprobará que el email verificado exista en `candidates.emailNormalized`, en `admin_allowlist.emailNormalized` o en ambas mediante filtros `@collection.*`. De esta forma, un email ajeno al padrón y a la lista administrativa no recibe un token válido aunque Google lo autentique.

Después del primer acceso, `POST /api/lomaton/auth/bootstrap` validará el token y sincronizará mediante la identidad técnica la relación `candidate`, `isAdmin`, `enabled` y `displayName`. El registro `users` podrá conservar ambos permisos. El cliente ejecutará luego `auth-refresh` para actualizar su modelo local.

Alternativa considerada: mantener una autenticación Google separada en Next.js. Se descarta porque duplicaría identidades y sesiones, mientras PocketBase ya ofrece OAuth2 y tokens para aplicar reglas de colección.

### 3. Modelo de datos relacional y restricciones redundantes

El esquema esperado se conservará versionado como referencia operativa y se aplicará a PocketBase mediante MCP:

- `users` (auth): email, relación opcional a `candidates` y permiso administrativo.
- `candidates`: nombre, apellido, email original, email normalizado, estado FTCA y estado operativo.
- `teams`: nombre, nombre normalizado, candidato responsable y estado de conformación.
- `team_memberships`: relaciones a equipo y candidato, origen de incorporación y momento de alta.
- `team_invitations`: equipo, candidato invitado, emisor, estado y fechas de resolución.
- `hackathon_settings`: registro único con plazo UTC, huso horario y apertura manual.
- `import_batches`: metadatos y resumen de cada importación, sin conservar innecesariamente el archivo original.
- `audit_logs`: actor, acción, entidad, instantáneas anterior/posterior, motivo y fecha.
- `service_accounts` (auth): identidad técnica de Next.js, con contraseña rotatable, sin alta pública ni acceso interactivo.

Los índices únicos cubrirán email normalizado, nombre de equipo normalizado, candidato en `team_memberships` y pares relevantes de invitaciones. `hackathon_settings` incluirá `dataVersion`, incrementado dentro de cada lote de mutación para detectar cambios concurrentes durante reportes. Las restricciones de base y las actualizaciones condicionales de contadores reducen carreras incluso si se reciben solicitudes simultáneas.

Alternativa considerada: guardar los miembros como una relación múltiple dentro de `teams`. Se descarta porque dificulta la unicidad global por candidato, la auditoría y las operaciones concurrentes.

### 4. Comandos críticos ejecutados por Next.js sobre API Batch

Las mutaciones de equipos, invitaciones, candidatos, configuración e importaciones se expondrán como Route Handlers de Next.js bajo `/api/lomaton/**`. Cada comando validará autenticación, rol, plazo, capacidad, disponibilidad y estado actual antes de construir un lote de escrituras.

Next.js autenticará ante una colección técnica de mínimo privilegio y enviará las escrituras relacionadas mediante la API Batch de PocketBase, habilitada y limitada explícitamente por MCP. PocketBase procesa el lote en una única transacción; cualquier fallo revierte todas las operaciones. Las API Rules de escritura aceptarán solamente esa identidad técnica.

Los comandos incluirán como mínimo: crear/disolver equipo, enviar/retirar invitación, aceptar/rechazar invitación y las variantes administrativas para reorganizar miembros. Al aceptar se actualizará el contador del equipo de forma condicional, se creará la membresía y se cancelarán las demás invitaciones pendientes en el mismo lote. El índice único de candidato y la condición sobre `memberCount` harán que una carrera incompatible falle y revierta el lote completo.

Alternativa considerada: validar solamente mediante API Rules y la interfaz. Se descarta porque dos aceptaciones concurrentes podrían superar límites antes de que la otra solicitud observe el cambio.

### 5. Estado de equipo derivado y persistido como proyección

La validez se calculará a partir de membresías aceptadas y el estado FTCA vigente. `teams.status` se mantendrá como una proyección para consultas (`draft`, `missing_ftca`, `complete`, `invalid`) y se recalculará dentro de los mismos Route Handlers que cambien membresías o candidatos.

La fuente de verdad seguirá siendo la combinación de membresías y candidatos; el estado persistido permitirá listar y exportar sin reconstruir repetidamente todo el grafo. Los Route Handlers recalcularán la proyección dentro del mismo lote que cambia membresías o FTCA. Una rutina de reconciliación verificable podrá corregir cualquier divergencia mediante lotes acotados.

### 6. Plazo guardado en UTC y presentado en hora argentina

El administrador ingresará la fecha y hora en `America/Argentina/Buenos_Aires`; la aplicación la convertirá a UTC antes de persistir. Todos los comandos evaluarán el instante actual del servidor frente al UTC almacenado, no frente al reloj del navegador. La zona IANA quedará registrada para presentación y auditoría.

### 7. Autorización por reglas y cuenta técnica limitada

Las API Rules permitirán las lecturas mínimas necesarias. Las escrituras gobernadas por comandos aceptarán solamente un registro activo de `service_accounts`; los usuarios normales, incluso administradores, no podrán realizarlas directamente. Cada Route Handler comprobará primero la identidad y el permiso del usuario solicitante.

La cuenta técnica se creará y rotará mediante MCP, tendrá solamente las capacidades otorgadas por API Rules y su credencial residirá en variables privadas de Next.js. Las credenciales `_superusers` se usarán exclusivamente por el MCP para administración explícita de esquema y no existirán en el entorno de ejecución de Next.js.

La lista inicial de administradores se cargará mediante MCP en `admin_allowlist`. Los administradores de la aplicación serán registros normales autenticados por Google y nunca `_superusers`.

### 8. Importaciones en dos fases y actualización por email

El Route Handler analizará CSV/XLSX, normalizará encabezados y valores y devolverá una vista previa firmada o reproducible. Al confirmar, construirá un lote PocketBase que hará `upsert` por email normalizado, registrará la importación, la auditoría y el incremento de versión. Las filas inválidas no se aplicarán y la omisión de un candidato no provocará bajas.

No se almacenará el archivo completo salvo que aparezca un requisito posterior de archivo documental. Esto minimiza datos duplicados y riesgos de retención.

### 9. Exportaciones generadas del lado servidor

Route Handlers autenticados consultarán directamente PocketBase con la identidad técnica y generarán CSV/XLSX. Para obtener una instantánea lógica leerán `dataVersion` antes y después de reunir los datos; si cambia, repetirán la lectura un número acotado de veces. Los valores se escaparán y se neutralizarán prefijos interpretables como fórmulas por hojas de cálculo. La fecha de generación se expresará en hora argentina.

## Risks / Trade-offs

- [La credencial técnica de Next.js podría filtrarse] -> Guardarla solamente en variables privadas de Dokploy, excluirla de logs y rotarla mediante MCP.
- [La API Batch podría configurarse con límites insuficientes o excesivos] -> Fijar límites compatibles con importaciones y reconciliaciones, dividir operaciones administrativas grandes en lotes acotados y medir duración.
- [Una validación previa puede quedar obsoleta antes de escribir] -> Respaldar las invariantes con índices únicos y actualizaciones condicionales incluidas en el mismo lote transaccional.
- [El popup OAuth2 puede ser bloqueado por algunos navegadores] -> Iniciar el flujo directamente desde el gesto de clic y ofrecer reintento con instrucciones claras.
- [Un cambio manual desde el dashboard PocketBase puede evitar comandos de negocio] -> Restringir el uso operativo del dashboard, ejecutar reconciliación y documentar que los cambios cotidianos se hacen desde la aplicación.
- [Guardar el token en el cliente amplía el impacto de una vulnerabilidad XSS] -> Aplicar CSP estricta, evitar HTML no confiable, minimizar dependencias del cliente y limitar duración/permisos del token.
- [PocketBase continúa evolucionando antes de su versión 1.0] -> Mantener fija la versión 0.40.1 y revisar compatibilidad antes de cualquier actualización explícita.
- [La edición de FTCA puede invalidar equipos cerca del cierre] -> Recalcular inmediatamente, mostrar alertas administrativas y conservar auditoría.
- [Importaciones grandes pueden superar límites HTTP o memoria] -> Definir límites de tamaño y filas, procesar con validación incremental y devolver errores accionables.

## Migration Plan

1. Mantener el backup descargado de PocketBase antes de cambios estructurales o de reglas.
2. Aplicar mediante MCP los cambios aditivos de esquema, reglas, configuración Batch, cuenta técnica y datos iniciales.
3. Configurar en Next.js la URL de PocketBase y la credencial técnica como variables privadas, sin credenciales `_superusers`.
4. Ejecutar localmente las pruebas unitarias, de integración, E2E, lint y build.
5. Hacer push a `main` para desplegar únicamente Next.js.
6. Ejecutar en producción las pruebas de login, importación, concurrencia de invitaciones, plazo, intervención administrativa y exportación.
7. Habilitar el acceso general una vez validado el padrón inicial.

Ante una falla del frontend se revierte el despliegue de Next.js al commit anterior. Los cambios aditivos de PocketBase se corrigen hacia adelante mediante MCP; solamente se restaura el backup cuando el impacto y la posible pérdida de acciones posteriores hayan sido evaluados explícitamente.

## Open Questions

- Nombres reales de las columnas del archivo de inscripción para definir aliases de importación.
- Límites operativos definitivos de tamaño de archivo, cantidad de candidatos y cantidad máxima de operaciones Batch.
- Procedimiento y periodicidad de rotación de la credencial técnica de Next.js.

## References

- [PocketBase authentication](https://pocketbase.io/docs/authentication/)
- [PocketBase API rules and filters](https://pocketbase.io/docs/api-rules-and-filters/)
- [PocketBase usage with web applications and SSR](https://pocketbase.io/docs/how-to-use/)
- [PocketBase collections](https://pocketbase.io/docs/collections/)
