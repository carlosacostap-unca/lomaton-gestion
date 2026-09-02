## ADDED Requirements

### Requirement: Filtrado de personas elegibles para invitaciones
El sistema SHALL permitir que el responsable de un equipo filtre los listados de estudiantes y docentes ya elegibles antes de seleccionar a quién invitar, sin ampliar los datos visibles ni modificar las reglas de elegibilidad.

#### Scenario: Listado completo sin búsqueda
- **WHEN** el responsable abre un selector o deja vacío el texto de búsqueda
- **THEN** el sistema muestra todas las personas elegibles disponibles para ese tipo de invitación

#### Scenario: Búsqueda de estudiante
- **WHEN** el responsable escribe parte del nombre o correo de un estudiante elegible
- **THEN** el selector muestra únicamente los estudiantes elegibles que coinciden, ignorando mayúsculas, minúsculas, tildes y espacios exteriores

#### Scenario: Búsqueda de docente
- **WHEN** el responsable escribe parte del nombre, departamento o descripción institucional de un docente elegible
- **THEN** el selector muestra únicamente los docentes elegibles que coinciden, ignorando mayúsculas, minúsculas, tildes y espacios exteriores

#### Scenario: Búsqueda sin coincidencias
- **WHEN** ningún integrante del listado elegible coincide con la búsqueda
- **THEN** el sistema muestra un estado vacío accesible y no permite enviar una invitación sin una selección válida

#### Scenario: Selección deja de coincidir
- **WHEN** el responsable cambia la búsqueda y la persona seleccionada deja de formar parte del resultado visible
- **THEN** el sistema limpia esa selección y exige escoger nuevamente antes de invitar

#### Scenario: Elegibilidad y privacidad preservadas
- **WHEN** el responsable filtra cualquiera de los listados
- **THEN** el sistema busca solamente sobre los campos ya autorizados de personas elegibles y nunca incorpora personas no disponibles ni datos privados adicionales
