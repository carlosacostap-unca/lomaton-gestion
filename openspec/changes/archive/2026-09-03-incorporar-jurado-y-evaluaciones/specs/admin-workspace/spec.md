## MODIFIED Requirements

### Requirement: Navegación administrativa por secciones
El sistema SHALL presentar a los administradores un menú con las secciones Resumen, Equipos, Certificados, Estudiantes, Docentes, Jurados, Evaluación, Importación y Configuración, y SHALL mostrar solamente la sección seleccionada. El menú SHALL NOT incluir destinos de Personas, Reportes ni Auditoría.

#### Scenario: Entrada al área administrativa
- **WHEN** un administrador accede a la ruta principal de administración
- **THEN** el sistema muestra el menú administrativo y la sección Resumen como contenido inicial

#### Scenario: Cambio de sección
- **WHEN** el administrador elige una opción del menú
- **THEN** el sistema sustituye el contenido principal por esa sección sin mantener visibles las demás herramientas

#### Scenario: Secciones excluidas
- **WHEN** el administrador consulta las opciones disponibles en el menú
- **THEN** encuentra Estudiantes, Docentes, Jurados y Evaluación, y no encuentra Personas, Reportes ni Auditoría como destinos de navegación ni como paneles de la pantalla principal

#### Scenario: Acceso directo a Docentes
- **WHEN** un administrador abre `/admin/docentes`
- **THEN** el sistema carga el directorio de docentes y marca Docentes como sección activa

#### Scenario: Acceso directo a Jurados
- **WHEN** un administrador abre `/admin/jurados`
- **THEN** el sistema carga la gestión de jurados y marca Jurados como sección activa

#### Scenario: Acceso directo a Evaluación
- **WHEN** un administrador abre `/admin/evaluacion`
- **THEN** el sistema carga el seguimiento del proceso y marca Evaluación como sección activa

#### Scenario: Acceso no administrativo
- **WHEN** una persona sin permisos administrativos intenta abrir cualquier sección del espacio
- **THEN** el sistema deniega el acceso sin exponer información administrativa
