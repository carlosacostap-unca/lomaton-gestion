## ADDED Requirements

### Requirement: Asignación de mentoría sin invitaciones
El sistema SHALL permitir que la mentoría de un equipo sea establecida únicamente mediante una asignación administrativa directa y SHALL impedir que estudiantes o docentes creen, retiren, acepten o rechacen invitaciones de mentoría.

#### Scenario: Equipo sin mentor
- **WHEN** un estudiante consulta un equipo que todavía no tiene mentor asignado
- **THEN** el sistema informa que la organización realizará la asignación y no muestra buscadores ni controles para invitar docentes

#### Scenario: Asignación administrativa visible
- **WHEN** un administrador asigna un mentor a un equipo
- **THEN** la asignación queda visible para los integrantes del equipo y para el docente sin requerir aceptación adicional

#### Scenario: Intento de usar el flujo anterior
- **WHEN** un estudiante o docente intenta crear, retirar o resolver una invitación de mentoría mediante una interfaz o solicitud anterior
- **THEN** el sistema deniega la operación y no modifica las asignaciones vigentes

#### Scenario: Invitaciones pendientes al cambiar de modelo
- **WHEN** entra en vigencia el modelo de asignación administrativa y existen invitaciones de mentoría pendientes
- **THEN** el sistema las deja canceladas como historial y evita que puedan convertirse posteriormente en asignaciones

### Requirement: Capacidad de mentoría sin límite por docente
El sistema MUST garantizar que cada equipo tenga como máximo un mentor asignado y SHALL permitir que un mismo docente sea mentor de cualquier cantidad de equipos, sin límite por docente.

#### Scenario: Docente asignado a varios equipos
- **WHEN** un administrador asigna a un equipo un docente que ya acompaña a uno o más equipos
- **THEN** el sistema crea la nueva asignación sin alterar las mentorías que ese docente ya tenía

#### Scenario: Equipo ya acompañado
- **WHEN** una operación intenta crear una segunda mentoría para el mismo equipo sin reemplazar la vigente
- **THEN** el sistema rechaza la operación y conserva exactamente un mentor para ese equipo

#### Scenario: Asignaciones simultáneas
- **WHEN** operaciones concurrentes asignan el mismo docente a equipos diferentes
- **THEN** todas las asignaciones compatibles con el máximo de un mentor por equipo pueden finalizar

## MODIFIED Requirements

### Requirement: Filtrado de personas elegibles para invitaciones
El sistema SHALL permitir que el responsable de un equipo filtre el listado de estudiantes ya elegibles antes de seleccionar a quién invitar, sin ampliar los datos visibles ni modificar las reglas de elegibilidad. El sistema SHALL impedir que el responsable consulte o filtre docentes con el propósito de invitarlos como mentores.

#### Scenario: Listado completo sin búsqueda
- **WHEN** el responsable abre el selector de estudiantes o deja vacío el texto de búsqueda
- **THEN** el sistema muestra todos los estudiantes elegibles disponibles para invitación

#### Scenario: Búsqueda de estudiante
- **WHEN** el responsable escribe parte del nombre o correo de un estudiante elegible
- **THEN** el selector muestra únicamente los estudiantes elegibles que coinciden, ignorando mayúsculas, minúsculas, tildes y espacios exteriores

#### Scenario: Búsqueda de docente
- **WHEN** el responsable consulta la sección de mentoría de su equipo
- **THEN** el sistema no muestra un buscador, selector ni listado de docentes para enviar invitaciones

#### Scenario: Búsqueda sin coincidencias
- **WHEN** ningún estudiante del listado elegible coincide con la búsqueda
- **THEN** el sistema muestra un estado vacío accesible y no permite enviar una invitación sin una selección válida

#### Scenario: Selección deja de coincidir
- **WHEN** el responsable cambia la búsqueda y el estudiante seleccionado deja de formar parte del resultado visible
- **THEN** el sistema limpia esa selección y exige escoger nuevamente antes de invitar

#### Scenario: Elegibilidad y privacidad preservadas
- **WHEN** el responsable filtra el listado de estudiantes
- **THEN** el sistema busca solamente sobre los campos ya autorizados y nunca incorpora personas no disponibles ni datos privados adicionales

### Requirement: Mentor separado de la membresía estudiantil
El sistema MUST representar cada mentoría separadamente de las membresías y SHALL excluir al docente del tamaño, la responsabilidad y el cálculo FTCA de todos los equipos que acompaña.

#### Scenario: Equipo con mentor
- **WHEN** un equipo posee una mentoría asignada
- **THEN** conserva su límite de cuatro candidatos, su responsable estudiantil y su estado calculado únicamente con miembros aceptados

#### Scenario: Docente consulta el equipo acompañado
- **WHEN** el mentor accede a su tablero
- **THEN** el sistema muestra todos los equipos que tiene asignados y, para cada uno, su nombre, estado e integrantes operativos sin exponer certificados ni datos privados de inscripción

#### Scenario: Integrante consulta al mentor
- **WHEN** un integrante consulta su equipo con mentor asignado
- **THEN** el sistema muestra la identidad operativa y pertenencia institucional permitida del docente en modo de solo lectura

## REMOVED Requirements

### Requirement: Invitación de docentes mentores disponibles

**Reason**: Los estudiantes ya no seleccionarán ni invitarán docentes; la organización realizará asignaciones directas.

**Migration**: Retirar los controles y endpoints de invitación estudiantil y cancelar las invitaciones pendientes, conservando su historial.

### Requirement: Respuesta consentida a invitaciones de mentoría

**Reason**: La asignación administrativa entra en vigencia inmediatamente y no requiere aceptación o rechazo del docente.

**Migration**: Retirar los controles y endpoints de resolución docente; el tablero docente pasa a listar las asignaciones vigentes.

### Requirement: Exclusividad concurrente de mentoría

**Reason**: Se elimina la exclusividad por docente y se conserva únicamente el máximo de un mentor por equipo.

**Migration**: Sustituir la restricción anterior por el requisito “Capacidad de mentoría sin límite por docente” y eliminar la unicidad de docente en las asignaciones.

### Requirement: Ciclo de vida de la mentoría

**Reason**: El ciclo basado en invitaciones y acciones del responsable deja de existir; la gestión pasa a administración.

**Migration**: Cancelar invitaciones pendientes y gestionar asignación, reemplazo o retiro mediante intervenciones administrativas auditadas.
