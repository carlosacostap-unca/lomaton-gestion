## MODIFIED Requirements

### Requirement: Acceso restringido por padrón y autorización administrativa
El sistema SHALL autorizar las funciones de candidato solamente cuando el email autenticado coincide con un candidato activo, SHALL autorizar las funciones de docente mentor solamente cuando coincide con una inscripción docente y un perfil de mentor activos, y SHALL autorizar las funciones administrativas solamente para emails configurados como administradores.

#### Scenario: Candidato incluido en el padrón
- **WHEN** el email autenticado coincide con un candidato activo
- **THEN** el usuario obtiene acceso a las funciones de candidato y a su inscripción vinculada

#### Scenario: Docente mentor incluido en el padrón
- **WHEN** el email autenticado coincide con una inscripción docente y un perfil de mentor activos
- **THEN** el usuario obtiene acceso a las funciones de docente mentor y a su inscripción vinculada sin adquirir permisos de candidato

#### Scenario: Administrador autorizado
- **WHEN** el email autenticado se encuentra autorizado como administrador
- **THEN** el usuario obtiene acceso al área administrativa

#### Scenario: Identidad con ambos permisos
- **WHEN** un email autorizado administrativamente también corresponde a un candidato o docente mentor activo
- **THEN** la identidad conserva ambos permisos y las acciones administrativas quedan diferenciadas en la auditoría

#### Scenario: Email no autorizado
- **WHEN** el email autenticado no pertenece a un candidato activo, a un docente mentor activo ni está autorizado como administrador
- **THEN** el sistema deniega el acceso a la aplicación y explica que debe contactar a la organización

#### Scenario: Participante desactivado o reclasificado
- **WHEN** una sesión se renueva después de que su inscripción, candidato o perfil de mentor dejó de habilitar ese rol
- **THEN** el sistema actualiza o revoca sus vínculos y no conserva permisos derivados del estado anterior
