# team-formation Specification

## Purpose

Permitir que los candidatos formen equipos mediante invitaciones consentidas, garantizando pertenencia exclusiva, límites de tamaño y la presencia de al menos un estudiante FTCA confirmado.

## Requirements

### Requirement: Creación de un equipo borrador
El sistema SHALL permitir que un candidato sin equipo cree un equipo con un nombre único y quede incorporado como miembro y responsable inicial.

#### Scenario: Creación válida
- **WHEN** un candidato disponible crea un equipo antes del cierre con un nombre válido no utilizado
- **THEN** el sistema crea un equipo borrador e incorpora al creador como primer miembro aceptado

#### Scenario: Candidato ya incorporado
- **WHEN** un candidato que ya pertenece a un equipo intenta crear otro
- **THEN** el sistema rechaza la operación sin modificar ninguno de los equipos

#### Scenario: Nombre duplicado
- **WHEN** el nombre solicitado coincide con otro equipo ignorando mayúsculas, minúsculas y espacios exteriores
- **THEN** el sistema solicita un nombre diferente

### Requirement: Invitación de candidatos disponibles
El sistema SHALL permitir que el responsable de un equipo borrador invite candidatos del padrón que todavía no pertenecen a otro equipo.

#### Scenario: Invitación válida
- **WHEN** el responsable invita a un candidato disponible y el equipo tiene capacidad potencial
- **THEN** el sistema crea una invitación pendiente visible para ambas partes

#### Scenario: Invitación repetida
- **WHEN** ya existe una invitación pendiente del mismo equipo para el candidato
- **THEN** el sistema no crea un duplicado e informa que la invitación ya existe

#### Scenario: Candidato ya incorporado
- **WHEN** el responsable intenta invitar a un candidato que ya pertenece a otro equipo
- **THEN** el sistema rechaza la invitación

### Requirement: Respuesta consentida a invitaciones
El sistema SHALL permitir que un candidato sin equipo acepte o rechace cada invitación pendiente dirigida a su identidad.

#### Scenario: Aceptación válida
- **WHEN** un candidato acepta una invitación y el equipo continúa teniendo cupo
- **THEN** el sistema lo incorpora exactamente una vez y cancela sus restantes invitaciones pendientes

#### Scenario: Rechazo
- **WHEN** un candidato rechaza una invitación pendiente
- **THEN** la invitación queda rechazada y el candidato permanece disponible

#### Scenario: Cupo agotado durante la aceptación
- **WHEN** el equipo alcanzó cuatro miembros antes de que el candidato acepte
- **THEN** el sistema rechaza la aceptación, cancela esa invitación y mantiene al candidato disponible

#### Scenario: Candidato incorporado concurrentemente
- **WHEN** el candidato pasó a pertenecer a otro equipo antes de procesarse la aceptación
- **THEN** el sistema rechaza la aceptación y evita una segunda membresía

### Requirement: Exclusividad y tamaño del equipo
El sistema MUST garantizar que cada candidato pertenezca como máximo a un equipo y que ningún equipo supere cuatro miembros aceptados.

#### Scenario: Operaciones simultáneas
- **WHEN** dos operaciones simultáneas intentan incorporar al mismo candidato o un quinto miembro
- **THEN** solamente una operación compatible con las reglas puede finalizar y la otra recibe un conflicto

### Requirement: Cálculo del estado de conformación
El sistema SHALL calcular el estado del equipo usando únicamente miembros aceptados y el estado FTCA vigente de esos miembros.

#### Scenario: Equipo completo y válido
- **WHEN** un equipo tiene tres o cuatro miembros aceptados y al menos uno posee estado FTCA `confirmado`
- **THEN** el equipo figura como completo y válido

#### Scenario: Cantidad insuficiente
- **WHEN** un equipo tiene menos de tres miembros aceptados
- **THEN** el equipo figura como borrador incompleto aunque tenga un integrante FTCA confirmado

#### Scenario: Sin integrante FTCA confirmado
- **WHEN** un equipo tiene tres o cuatro miembros aceptados pero ninguno posee estado FTCA `confirmado`
- **THEN** el equipo figura como incompleto por requisito FTCA

#### Scenario: Invitaciones pendientes
- **WHEN** un equipo tiene invitaciones pendientes
- **THEN** esas invitaciones no cuentan para el tamaño ni para el cumplimiento FTCA

### Requirement: Gestión del borrador por su responsable
El sistema SHALL permitir al responsable retirar invitaciones pendientes o disolver su equipo antes del cierre, sin permitirle expulsar unilateralmente a miembros que ya aceptaron.

#### Scenario: Retiro de invitación
- **WHEN** el responsable retira una invitación pendiente antes del cierre
- **THEN** la invitación queda cancelada sin alterar otras membresías

#### Scenario: Disolución voluntaria
- **WHEN** el responsable disuelve el equipo antes del cierre
- **THEN** sus miembros vuelven a quedar disponibles y las invitaciones pendientes se cancelan

#### Scenario: Intento de expulsión directa
- **WHEN** el responsable intenta retirar a un miembro aceptado
- **THEN** el sistema deniega la operación e indica que requiere intervención administrativa
