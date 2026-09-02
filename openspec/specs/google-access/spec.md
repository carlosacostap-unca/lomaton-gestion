# google-access Specification

## Purpose

Permitir un acceso seguro mediante Google, vinculando la identidad autenticada con el padrón importado o con una autorización administrativa explícita, sin administrar contraseñas locales.

## Requirements

### Requirement: Inicio de sesión exclusivo con Google
El sistema SHALL ofrecer autenticación con Google y SHALL utilizar el email verificado entregado por Google como identidad de acceso.

#### Scenario: Inicio de sesión exitoso
- **WHEN** Google autentica al usuario y entrega un email verificado autorizado
- **THEN** el sistema inicia una sesión asociada a ese email normalizado

#### Scenario: Fallo o cancelación en Google
- **WHEN** el usuario cancela el flujo o Google no puede autenticarlo
- **THEN** el sistema no inicia sesión y permite volver a intentar sin revelar información sensible

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

### Requirement: Coincidencia explícita del email importado
El sistema SHALL impedir que una identidad Google diferente sea vinculada automáticamente a un candidato, aunque el nombre de la persona coincida.

#### Scenario: Cuenta Google con otro email
- **WHEN** una persona se autentica con un email distinto del que figura en el padrón
- **THEN** el sistema deniega las funciones de candidato e indica cuál es el procedimiento de asistencia administrativa

### Requirement: Ayuda para correos que no son Gmail
La pantalla de acceso SHALL explicar que una dirección existente puede utilizarse para crear una cuenta Google sin convertirse en Gmail y SHALL enlazar las instrucciones oficiales de Google.

#### Scenario: Usuario necesita asociar su correo
- **WHEN** el usuario solicita ayuda desde la pantalla de acceso
- **THEN** el sistema muestra los pasos para elegir “Usar mi dirección de correo electrónico actual”, verificar el correo y regresar a iniciar sesión

### Requirement: Cierre de sesión
El sistema SHALL permitir que cualquier usuario autenticado cierre su sesión y SHALL eliminar las credenciales locales utilizadas por la aplicación.

#### Scenario: Cierre exitoso
- **WHEN** el usuario selecciona cerrar sesión
- **THEN** el sistema elimina su estado autenticado y vuelve a la pantalla de acceso
