## Purpose

Proporcionar a los administradores un directorio privado y consolidado de estudiantes que reúna su pertenencia académica, situación documental y participación en equipos.

## ADDED Requirements

### Requirement: Listado exclusivo de estudiantes registrados
El sistema SHALL mostrar a los administradores un listado con una entrada por inscripción estudiantil vigente o conservada, SHALL excluir perfiles docentes y exclusivamente administrativos, y SHALL identificar cada entrada mediante el nombre completo y la facultad o unidad académica registrada.

#### Scenario: Consulta del directorio
- **WHEN** un administrador abre la sección Estudiantes
- **THEN** el sistema lista los estudiantes registrados ordenados de forma estable por nombre y muestra para cada uno su nombre completo y facultad

#### Scenario: Facultad de estudiante FTCA
- **WHEN** una inscripción corresponde a un estudiante FTCA y no posee otra unidad académica informada
- **THEN** el sistema muestra FTyCA como facultad de referencia

#### Scenario: Facultad no informada
- **WHEN** la inscripción estudiantil no permite determinar una facultad o unidad académica
- **THEN** el sistema indica “No informada” sin omitir al estudiante

#### Scenario: Exclusión de otros roles
- **WHEN** existen docentes o cuentas exclusivamente administrativas registradas
- **THEN** el sistema no las incluye en el directorio de Estudiantes

#### Scenario: Directorio vacío
- **WHEN** no existen inscripciones estudiantiles
- **THEN** el sistema muestra un estado vacío comprensible en lugar de una tabla sin contexto

### Requirement: Estado documental resumido
El sistema SHALL indicar separadamente si cada estudiante presentó un certificado y, cuando exista uno vigente, si su validación está pendiente, aprobada o rechazada.

#### Scenario: Certificado no presentado
- **WHEN** el estudiante no tiene un certificado vigente
- **THEN** el listado indica que no lo presentó y que no posee validación

#### Scenario: Certificado pendiente
- **WHEN** el estudiante tiene un certificado vigente en estado `pending` o sin estado histórico explícito
- **THEN** el listado indica que fue presentado y está pendiente de validación

#### Scenario: Certificado aprobado
- **WHEN** el certificado vigente está en estado `approved`
- **THEN** el listado indica que fue presentado y validado

#### Scenario: Certificado rechazado
- **WHEN** el certificado vigente está en estado `rejected`
- **THEN** el listado indica que fue presentado y rechazado sin revelar el motivo en la vista resumida

### Requirement: Situación de equipo e invitaciones
El sistema SHALL mostrar el equipo al que pertenece cada estudiante mediante una membresía aceptada y SHALL mostrar las invitaciones de equipo que permanezcan pendientes para ese estudiante.

#### Scenario: Estudiante integrante de un equipo
- **WHEN** el estudiante posee una membresía aceptada
- **THEN** el listado muestra el nombre del equipo al que pertenece

#### Scenario: Estudiante con invitaciones pendientes
- **WHEN** el estudiante no pertenece a un equipo y posee una o más invitaciones pendientes
- **THEN** el listado muestra los nombres de los equipos que lo invitaron o una representación equivalente que permita identificarlos

#### Scenario: Estudiante disponible sin invitaciones
- **WHEN** el estudiante no pertenece a un equipo ni posee invitaciones pendientes
- **THEN** el listado indica que está sin equipo y sin invitaciones pendientes

### Requirement: Continuidad de la edición administrativa
El sistema SHALL permitir que el administrador acceda desde cada estudiante a la edición de su inscripción y SHALL actualizar el directorio después de guardar cambios válidos.

#### Scenario: Apertura de edición
- **WHEN** el administrador elige editar un estudiante del listado
- **THEN** el sistema muestra los controles administrativos vigentes para esa inscripción sin incorporar perfiles docentes al directorio

#### Scenario: Edición confirmada
- **WHEN** el administrador guarda datos válidos del estudiante
- **THEN** el sistema aplica la edición y actualiza la entrada visible con la información vigente

### Requirement: Privacidad del directorio consolidado
El sistema MUST restringir el directorio y su consulta agregada a administradores autorizados y SHALL limitar la respuesta a los datos necesarios para la vista, sin incluir el contenido del certificado, credenciales de almacenamiento, DNI, teléfono ni datos de otros roles.

#### Scenario: Consulta administrativa autorizada
- **WHEN** una cuenta administradora solicita el directorio
- **THEN** el sistema entrega únicamente la proyección estudiantil necesaria para la vista

#### Scenario: Consulta no administrativa
- **WHEN** una cuenta no administradora o una solicitud anónima intenta consultar el directorio
- **THEN** el sistema deniega el acceso sin revelar estudiantes, certificados, equipos ni invitaciones
