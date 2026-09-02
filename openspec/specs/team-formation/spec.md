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
