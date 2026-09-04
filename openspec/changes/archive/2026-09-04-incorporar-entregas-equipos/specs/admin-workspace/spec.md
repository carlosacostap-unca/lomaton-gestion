## MODIFIED Requirements

### Requirement: Navegación administrativa por secciones
El sistema SHALL presentar a los administradores un menú con las secciones Resumen, Equipos, Entregas, Certificados, Estudiantes, Docentes, Jurados, Evaluación, Importación y Configuración, y SHALL mostrar solamente la sección seleccionada. El menú SHALL NOT incluir destinos de Personas, Reportes ni Auditoría.

#### Scenario: Entrada al área administrativa
- **WHEN** un administrador accede a la ruta principal de administración
- **THEN** el sistema muestra el menú administrativo y la sección Resumen como contenido inicial

#### Scenario: Cambio de sección
- **WHEN** el administrador elige una opción del menú
- **THEN** el sistema sustituye el contenido principal por esa sección sin mantener visibles las demás herramientas

#### Scenario: Secciones excluidas
- **WHEN** el administrador consulta las opciones disponibles en el menú
- **THEN** encuentra Equipos, Entregas, Estudiantes, Docentes, Jurados y Evaluación, y no encuentra Personas, Reportes ni Auditoría como destinos de navegación ni como paneles de la pantalla principal

#### Scenario: Acceso directo a Entregas
- **WHEN** un administrador abre `/admin/entregas`
- **THEN** el sistema carga el seguimiento de entregas y marca Entregas como sección activa

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

## ADDED Requirements

### Requirement: Seguimiento administrativo de entregas
El sistema SHALL ofrecer en la sección Entregas un listado filtrable de todos los equipos con su estado de entrega, productos presentes y faltantes, última actualización y fecha de finalización, y SHALL permitir abrir el detalle y los archivos o enlaces en modo lectura.

#### Scenario: Resumen de entregas
- **WHEN** un administrador abre la sección Entregas
- **THEN** el sistema muestra cantidades y filas para equipos sin entrega, borradores incompletos, borradores completos y entregas finalizadas

#### Scenario: Filtro de pendientes
- **WHEN** el administrador filtra equipos con productos obligatorios faltantes o sin finalización
- **THEN** el sistema muestra solamente los equipos coincidentes y conserva visible el motivo de cada estado

#### Scenario: Detalle de un equipo
- **WHEN** el administrador selecciona una entrega
- **THEN** el sistema presenta sus cinco productos, modalidades, metadatos, faltantes y fechas con acciones de lectura o descarga, sin controles de modificación
