# admin-workspace Specification

## Purpose

Organizar las herramientas administrativas en un espacio navegable, adaptable y enlazable que cargue únicamente la sección elegida y reduzca la sobrecarga visual.

## Requirements

### Requirement: Navegación administrativa por secciones
El sistema SHALL presentar a los administradores un menú con las secciones Resumen, Equipos, Certificados, Estudiantes, Docentes, Importación y Configuración, y SHALL mostrar solamente la sección seleccionada. El menú SHALL NOT incluir destinos de Personas, Reportes ni Auditoría.

#### Scenario: Entrada al área administrativa
- **WHEN** un administrador accede a la ruta principal de administración
- **THEN** el sistema muestra el menú administrativo y la sección Resumen como contenido inicial

#### Scenario: Cambio de sección
- **WHEN** el administrador elige una opción del menú
- **THEN** el sistema sustituye el contenido principal por esa sección sin mantener visibles las demás herramientas

#### Scenario: Secciones excluidas
- **WHEN** el administrador consulta las opciones disponibles en el menú
- **THEN** encuentra Estudiantes y Docentes, y no encuentra Personas, Reportes ni Auditoría como destinos de navegación ni como paneles de la pantalla principal

#### Scenario: Acceso directo a Docentes
- **WHEN** un administrador abre `/admin/docentes`
- **THEN** el sistema carga el directorio de docentes y marca Docentes como sección activa

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

### Requirement: Carga aislada de secciones
El sistema SHALL cargar los datos y montar los controles de una sección únicamente cuando esa sección esté activa, y SHALL aislar sus estados de carga y error de las demás.

#### Scenario: Sección no visitada
- **WHEN** el administrador permanece en una sección
- **THEN** las secciones no seleccionadas no realizan sus consultas de datos ni renderizan sus formularios

#### Scenario: Carga de sección
- **WHEN** el administrador selecciona una sección que necesita datos remotos
- **THEN** el sistema muestra un estado de carga dentro del contenido principal hasta completar la consulta

#### Scenario: Error aislado
- **WHEN** falla la consulta de la sección activa
- **THEN** el sistema muestra un error accionable en esa sección y mantiene utilizable el menú para navegar a otra

### Requirement: Navegación adaptable y accesible
El sistema MUST conservar una navegación operable por teclado, con foco y opción activa perceptibles, y SHALL adaptar la presentación del menú y del contenido a pantallas estrechas.

#### Scenario: Pantalla amplia
- **WHEN** el área administrativa dispone de ancho suficiente
- **THEN** el sistema presenta navegación persistente y contenido principal diferenciados visualmente

#### Scenario: Pantalla estrecha
- **WHEN** el administrador usa un dispositivo móvil o una ventana estrecha
- **THEN** el menú se presenta de forma compacta sin producir desplazamiento horizontal ni ocultar la sección activa

#### Scenario: Navegación por teclado
- **WHEN** el administrador recorre el menú sin utilizar un puntero
- **THEN** puede identificar el foco, activar cualquier destino y conocer cuál es la sección vigente
