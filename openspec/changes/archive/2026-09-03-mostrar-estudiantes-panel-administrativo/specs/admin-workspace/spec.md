## MODIFIED Requirements

### Requirement: Navegación administrativa por secciones
El sistema SHALL presentar a los administradores un menú con las secciones Resumen, Equipos, Certificados, Estudiantes, Importación y Configuración, y SHALL mostrar solamente la sección seleccionada. El menú SHALL NOT incluir destinos de Personas, Reportes ni Auditoría.

#### Scenario: Entrada al área administrativa
- **WHEN** un administrador accede a la ruta principal de administración
- **THEN** el sistema muestra el menú administrativo y la sección Resumen como contenido inicial

#### Scenario: Cambio de sección
- **WHEN** el administrador elige una opción del menú
- **THEN** el sistema sustituye el contenido principal por esa sección sin mantener visibles las demás herramientas

#### Scenario: Secciones excluidas
- **WHEN** el administrador consulta las opciones disponibles en el menú
- **THEN** encuentra Estudiantes y no encuentra Personas, Reportes ni Auditoría como destinos de navegación ni como paneles de la pantalla principal

#### Scenario: Acceso no administrativo
- **WHEN** una persona sin permisos administrativos intenta abrir cualquier sección del espacio
- **THEN** el sistema deniega el acceso sin exponer información administrativa

### Requirement: Estado de navegación enlazable
El sistema SHALL representar la sección administrativa activa mediante una URL estable y SHALL preservar la navegación esperada del navegador, incluyendo una transición compatible desde la antigua URL de Personas hacia Estudiantes.

#### Scenario: Enlace directo
- **WHEN** un administrador abre o comparte la URL de una sección autorizada
- **THEN** el sistema carga directamente esa sección y marca su opción como activa

#### Scenario: Recarga
- **WHEN** el administrador recarga el navegador dentro de una sección
- **THEN** permanece en la misma sección

#### Scenario: Navegación hacia atrás
- **WHEN** el administrador usa las acciones de retroceso o avance del navegador
- **THEN** el sistema restaura la sección correspondiente a la URL recorrida

#### Scenario: Ruta anterior de Personas
- **WHEN** un administrador abre la antigua URL `/admin/personas`
- **THEN** el sistema lo redirige a `/admin/estudiantes` y presenta la sección Estudiantes como activa

#### Scenario: Destino administrativo desconocido
- **WHEN** el administrador solicita una sección inexistente
- **THEN** el sistema ofrece una salida clara hacia Resumen sin mostrar contenido de otra sección por error
