## Why

La administración concentra actualmente todas sus herramientas en una sola página extensa, lo que obliga a recorrer demasiado contenido y hace difícil encontrar y operar sobre certificados o equipos. La revisión documental también fuerza la descarga del PDF, aun cuando el administrador sólo necesita inspeccionarlo antes de decidir.

## What Changes

- Incorporar un espacio administrativo seccionado y adaptable, con destinos para Resumen, Equipos, Certificados, Personas, Importación y Configuración.
- Cargar y montar solamente la sección elegida, conservando su estado en la URL para permitir recarga, navegación hacia atrás y enlaces directos.
- Retirar Reportes y Auditoría de la navegación y de la pantalla administrativa principal; los registros históricos, la auditoría interna y los endpoints de exportación existentes no se eliminan como parte de este cambio.
- Convertir la revisión de certificados en una experiencia de lista y detalle que permita visualizar el PDF dentro de la plataforma, aprobarlo, rechazarlo o descargarlo.
- Reemplazar la presentación expandida de todos los equipos por un listado resumido, con búsqueda y filtros, desde el cual se accede al detalle operativo de un único equipo.
- Mantener las mismas autorizaciones, reglas de negocio, trazabilidad y controles de concurrencia en todas las operaciones administrativas.

## Capabilities

### New Capabilities

- `admin-workspace`: navegación seccionada, carga bajo demanda, estado enlazable y comportamiento adaptable del espacio administrativo.

### Modified Capabilities

- `student-certificates`: añade visualización autenticada del PDF dentro de la revisión administrativa sin sustituir la descarga.
- `hackathon-administration`: presenta los equipos como listado resumido y detalle individual para ejecutar intervenciones administrativas.

## Impact

- Estructura de rutas, layout y navegación bajo `/admin`.
- Página administrativa y componentes de resumen, equipos, certificados, padrón, importación y configuración.
- Obtención autenticada, ciclo de vida temporal y visualización en navegador de archivos PDF.
- Consultas o DTO administrativos para separar resúmenes de equipos de su detalle operativo.
- Estilos responsivos, estados de carga, foco, navegación por teclado y pruebas de componentes, rutas e integración.
