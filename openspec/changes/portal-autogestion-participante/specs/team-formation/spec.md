## ADDED Requirements

### Requirement: Invitación de docentes mentores disponibles
El sistema SHALL permitir que el responsable de un equipo invite, durante el período de formación, a un docente con perfil activo, interés de mentoría afirmativo y sin equipo asignado.

#### Scenario: Invitación válida de mentoría
- **WHEN** el responsable invita a un docente elegible y el equipo no posee mentor
- **THEN** el sistema crea una invitación de mentoría pendiente visible para el responsable y para el docente

#### Scenario: Docente no disponible
- **WHEN** el responsable intenta invitar a un docente inactivo, sin interés afirmativo o ya asignado a otro equipo
- **THEN** el sistema rechaza la invitación sin revelar datos privados adicionales

#### Scenario: Equipo ya acompañado
- **WHEN** el responsable intenta invitar a otro docente después de que el equipo obtuvo un mentor
- **THEN** el sistema rechaza la invitación porque el equipo ya alcanzó su máximo de mentoría

#### Scenario: Invitación repetida
- **WHEN** ya existe una invitación pendiente del mismo equipo para el mismo docente
- **THEN** el sistema no crea un duplicado e informa que la invitación ya existe

### Requirement: Respuesta consentida a invitaciones de mentoría
El sistema SHALL permitir que un docente elegible acepte o rechace cada invitación de mentoría pendiente dirigida a su perfil.

#### Scenario: Aceptación válida de mentoría
- **WHEN** un docente disponible acepta una invitación y el equipo continúa sin mentor
- **THEN** el sistema crea exactamente una asignación entre ambos y marca la invitación como aceptada

#### Scenario: Rechazo de mentoría
- **WHEN** un docente rechaza una invitación pendiente
- **THEN** la invitación queda rechazada y tanto el docente como el equipo conservan su disponibilidad anterior

#### Scenario: Invitación perteneciente a otro docente
- **WHEN** un docente intenta resolver una invitación dirigida a otro perfil
- **THEN** el sistema deniega la operación sin modificar la invitación

### Requirement: Exclusividad concurrente de mentoría
El sistema MUST garantizar que cada equipo tenga como máximo un mentor aceptado y que cada docente sea mentor de como máximo un equipo, incluso frente a aceptaciones simultáneas.

#### Scenario: Docente acepta entre varios equipos
- **WHEN** un docente acepta válidamente una invitación
- **THEN** el sistema cancela sus restantes invitaciones pendientes de otros equipos dentro de la misma operación

#### Scenario: Equipo elige entre varios docentes
- **WHEN** un docente acepta válidamente la invitación de un equipo
- **THEN** el sistema cancela las restantes invitaciones de mentoría pendientes emitidas por ese equipo dentro de la misma operación

#### Scenario: Aceptaciones simultáneas
- **WHEN** operaciones concurrentes intentan asignar un docente a dos equipos o dos docentes al mismo equipo
- **THEN** solamente una asignación compatible con ambas restricciones puede finalizar y las demás reciben un conflicto

### Requirement: Mentor separado de la membresía estudiantil
El sistema MUST representar la mentoría separadamente de las membresías y SHALL excluir al docente del tamaño, la responsabilidad y el cálculo FTCA del equipo.

#### Scenario: Equipo con mentor
- **WHEN** un equipo posee una mentoría aceptada
- **THEN** conserva su límite de cuatro candidatos, su responsable estudiantil y su estado calculado únicamente con miembros aceptados

#### Scenario: Docente consulta el equipo acompañado
- **WHEN** el mentor accede a su asignación
- **THEN** el sistema muestra el nombre, estado e integrantes operativos del equipo sin exponer certificados ni datos privados de inscripción

#### Scenario: Integrante consulta al mentor
- **WHEN** un integrante consulta su equipo con mentor asignado
- **THEN** el sistema muestra la identidad operativa y pertenencia institucional permitida del docente

### Requirement: Ciclo de vida de la mentoría
El sistema SHALL permitir retirar una invitación de mentoría pendiente al responsable y SHALL cancelar invitaciones y asignaciones asociadas cuando el equipo se disuelve, manteniendo trazabilidad de las transiciones.

#### Scenario: Retiro de invitación pendiente
- **WHEN** el responsable retira una invitación de mentoría antes del cierre
- **THEN** la invitación queda retirada y el docente permanece disponible

#### Scenario: Operación después del cierre
- **WHEN** un participante intenta crear, retirar o resolver una invitación de mentoría después del cierre
- **THEN** el sistema rechaza la operación sin alterar el estado vigente

#### Scenario: Disolución del equipo
- **WHEN** el responsable disuelve un equipo con invitaciones o mentoría
- **THEN** el sistema cancela los vínculos asociados y el docente vuelve a quedar disponible

