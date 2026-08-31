## Why

La organización del hackatón necesita convertir un padrón previo de personas inscriptas en equipos válidos, evitando duplicidades, incorporaciones sin consentimiento y equipos que incumplan las condiciones institucionales. La aplicación debe ofrecer autoservicio a los candidatos y una vía administrativa de resolución para los casos que no puedan completarse normalmente.

## What Changes

- Incorporar un padrón de candidatos desde archivos CSV o Excel, con previsualización, validación, actualización por email y reporte de filas inválidas.
- Registrar la pertenencia a la Facultad de Tecnología y Ciencias Aplicadas (FTCA) como un estado administrable: confirmado, no pertenece o pendiente de validación.
- Permitir el acceso con Google únicamente a candidatos importados y administradores autorizados, incluyendo ayuda para asociar una dirección no Gmail a una cuenta Google.
- Permitir que un candidato cree un equipo borrador, invite compañeros y gestione las invitaciones recibidas.
- Restringir a cada candidato a un único equipo y considerar completo solamente un equipo con tres o cuatro integrantes aceptados y al menos un integrante FTCA confirmado.
- Permitir varias invitaciones pendientes por candidato y cancelar las restantes cuando acepte una.
- Permitir al administrador crear, completar, modificar, reorganizar y disolver equipos, además de actuar en representación de candidatos ante problemas de acceso.
- Incorporar una fecha y hora límite configurable en el huso horario de Argentina, tras la cual se bloquean las operaciones de los candidatos pero no las intervenciones administrativas.
- Permitir al administrador bloquear o reabrir la formación de equipos y exportar candidatos, equipos e integrantes a CSV o Excel.
- Registrar las intervenciones administrativas y advertir cuando una modificación deje inválido un equipo previamente completo.
- Ejecutar la lógica autoritativa de autenticación, equipos, importaciones, administración y reportes en Route Handlers de Next.js, manteniendo PocketBase como servicio de datos separado.
- Administrar los cambios de esquema y configuración de PocketBase de forma explícita mediante MCP, sin asociarlos al despliegue automático de cada push.

## Capabilities

### New Capabilities

- `candidate-roster`: Importación, validación, actualización y administración del padrón de candidatos y su estado FTCA.
- `google-access`: Autenticación con Google, autorización por email importado y acceso administrativo autorizado.
- `team-formation`: Creación de equipos borrador, invitaciones, aceptación y reglas de composición y exclusividad.
- `hackathon-administration`: Configuración del plazo, bloqueo operativo, intervención administrativa y auditoría.
- `hackathon-reporting`: Consulta y exportación de candidatos, equipos, integrantes y estados de validación.

### Modified Capabilities

No hay capacidades existentes que deban modificarse.

## Impact

- La aplicación Next.js incorporará interfaces públicas autenticadas y un área administrativa.
- PocketBase será el backend persistente y proveedor de autenticación OAuth2 con Google, utilizando la instancia ya desplegada en el VPS mediante Dokploy.
- Los pushes a `main` desplegarán solamente la aplicación Next.js; la aplicación PocketBase permanecerá separada en Dokploy.
- El esquema, los índices, las reglas y los registros técnicos de PocketBase se administrarán explícitamente mediante MCP y no mediante hooks o migraciones ejecutados en cada despliegue.
- Las mutaciones de servidor utilizarán una identidad técnica de mínimo privilegio y la API Batch transaccional de PocketBase, sin exponer credenciales de superusuario en el navegador ni en tiempo de ejecución.
- Se agregarán dependencias para el SDK de PocketBase y para leer y generar archivos CSV y Excel.
- La configuración de despliegue de Next.js requerirá la URL pública de PocketBase, una credencial técnica limitada y valores seguros exclusivamente del lado servidor; OAuth2 de Google seguirá configurado en PocketBase.
