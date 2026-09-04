## Why

Los equipos no disponen de un canal único y controlado para presentar los productos finales del hackatón, por lo que la organización y el jurado no pueden saber con certeza qué entregó cada equipo ni consultar sus materiales desde la plataforma. Se necesita una entrega compartida por equipo, con requisitos explícitos y un cierre temporal independiente del período de formación.

## What Changes

- Incorporar una entrega única por equipo que pueda ser preparada y actualizada por sus integrantes hasta una fecha y hora límite configurada para el hackatón.
- Solicitar cinco productos con estos contratos: Presentación obligatoria mediante archivo o enlace; Canvas obligatorio mediante archivo; Informe obligatorio mediante archivo; Evidencia del desarrollo alcanzado obligatoria mediante archivo o enlace; y Video opcional mediante enlace.
- Validar en el servidor la obligatoriedad y el medio permitido de cada producto, mostrar el avance de la entrega y permitir finalizarla sólo cuando los cuatro productos obligatorios sean válidos.
- Mantener archivos y enlaces como materiales privados del hackatón, accesibles únicamente para integrantes del equipo correspondiente, administradores y jurados activos; los jurados y administradores tendrán acceso de lectura a las entregas de todos los equipos.
- Permitir reemplazar productos y volver a finalizar la entrega mientras el plazo esté vigente; al alcanzar el límite, bloquear automáticamente nuevas altas, reemplazos y finalizaciones conservando la última versión guardada.
- Permitir que la administración configure y modifique una fecha y hora límite de entrega interpretada en `America/Argentina/Buenos_Aires`, separada del plazo de formación de equipos, y visualizar el estado de cumplimiento por equipo.
- Integrar la consulta de entregables en los espacios existentes de participantes, administración y jurado sin exponer URLs internas, tokens de archivos protegidos ni datos de otros equipos a los participantes.

## Capabilities

### New Capabilities

- `team-deliverables`: carga, validación, finalización, privacidad, consulta y cierre temporal de los productos finales compartidos por cada equipo.

### Modified Capabilities

- `hackathon-administration`: añadir la configuración y auditoría de un plazo de entrega independiente del plazo de formación.
- `participant-self-service`: permitir que integrantes vigentes consulten y gestionen la entrega compartida de su propio equipo.
- `admin-workspace`: incorporar una sección administrativa enlazable para supervisar entregas y acceder a sus productos.
- `jury-evaluation`: permitir que cada jurado activo consulte los productos entregados por los equipos que debe evaluar, sin otorgarle permisos de modificación.

## Impact

- Esquema y migraciones de PocketBase para la configuración del plazo, el registro único de entrega por equipo y sus productos protegidos.
- Variables y límites operativos para cargas multipart, validación de archivos y descarga autenticada mediante Route Handlers de Next.js.
- Comandos de dominio, auditoría, control de concurrencia y rutas autenticadas para guardar, finalizar, listar y descargar entregables.
- Portal del participante, nueva sección administrativa de Entregas y portal del jurado.
- Documentación de despliegue, esquema y seguridad del almacenamiento privado.
- Pruebas unitarias, de rutas, autorización, concurrencia, persistencia y E2E para participantes, administradores y jurados.
