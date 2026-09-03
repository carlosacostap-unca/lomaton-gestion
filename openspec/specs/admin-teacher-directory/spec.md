# admin-teacher-directory Specification

## Purpose

Proporcionar a los administradores una vista privada centrada en docentes para conocer su disponibilidad y gestionar de forma segura las mentorías de uno o varios equipos.

## Requirements

### Requirement: Directorio exclusivo de docentes
El sistema SHALL mostrar a los administradores una entrada por inscripción docente, SHALL excluir estudiantes y cuentas exclusivamente administrativas, y SHALL indicar para cada docente su nombre, departamento o unidad académica, estado activo e interés declarado en participar como mentor.

#### Scenario: Consulta del directorio
- **WHEN** un administrador abre la sección Docentes
- **THEN** el sistema lista las inscripciones docentes ordenadas de forma estable por nombre con sus datos académicos y su disponibilidad para mentorías

#### Scenario: Docente sin unidad académica
- **WHEN** una inscripción docente no posee departamento ni unidad académica informada
- **THEN** el sistema muestra “No informada” sin omitir al docente

#### Scenario: Exclusión de otros roles
- **WHEN** existen estudiantes o cuentas exclusivamente administrativas registradas
- **THEN** el sistema no las incluye en el directorio de Docentes

#### Scenario: Directorio vacío
- **WHEN** no existen inscripciones docentes
- **THEN** el sistema presenta un estado vacío comprensible

### Requirement: Búsqueda y disponibilidad de mentoría
El sistema SHALL permitir filtrar docentes por nombre, departamento, unidad académica, equipo asignado o disponibilidad, y SHALL distinguir como asignables únicamente los perfiles docentes activos que hayan declarado interés afirmativo en mentorías.

#### Scenario: Filtro de docentes
- **WHEN** el administrador ingresa un criterio o selecciona un estado de disponibilidad
- **THEN** el sistema muestra solamente los docentes coincidentes e informa si no existen resultados

#### Scenario: Docente disponible
- **WHEN** el perfil docente está activo y posee interés afirmativo en mentorías
- **THEN** el sistema permite iniciar una nueva asignación para ese docente

#### Scenario: Docente no disponible
- **WHEN** el perfil docente está inactivo o no posee interés afirmativo en mentorías
- **THEN** el sistema muestra la causa de indisponibilidad y no ofrece confirmar una nueva asignación

### Requirement: Equipos acompañados por docente
El sistema SHALL mostrar todos los equipos asignados a cada docente sin establecer un máximo de mentorías por docente.

#### Scenario: Docente sin equipos
- **WHEN** el docente no posee mentorías vigentes
- **THEN** el directorio indica que todavía no tiene equipos asignados

#### Scenario: Docente con varios equipos
- **WHEN** el docente posee mentorías vigentes en dos o más equipos
- **THEN** el sistema muestra todos esos equipos en su entrada sin resumirlos como una única asignación

### Requirement: Asignación administrativa desde el docente
El sistema SHALL permitir que un administrador asigne a un docente disponible como mentor de cualquier equipo, SHALL conservar las demás mentorías del mismo docente y MUST mantener como máximo una mentoría vigente por equipo.

#### Scenario: Primera asignación del docente
- **WHEN** el administrador asigna un equipo sin mentor a un docente disponible
- **THEN** el sistema crea la mentoría, la muestra en la lista del docente y registra la intervención administrativa

#### Scenario: Asignación adicional
- **WHEN** el administrador asigna otro equipo a un docente que ya acompaña uno o más equipos
- **THEN** el sistema añade la nueva mentoría sin retirar ni modificar las asignaciones anteriores

#### Scenario: Equipo ya asignado al mismo docente
- **WHEN** el administrador selecciona un equipo que ya tiene al mismo docente como mentor
- **THEN** el sistema evita crear un duplicado e informa que la asignación ya existe

#### Scenario: Reemplazo del mentor de un equipo
- **WHEN** el administrador selecciona un equipo que ya posee otro mentor
- **THEN** el sistema identifica al mentor actual, solicita confirmación explícita del reemplazo y, al confirmarse, conserva exactamente una mentoría para el equipo

#### Scenario: Asignación fuera del período abierto
- **WHEN** el administrador confirma una asignación con la formación cerrada
- **THEN** el sistema exige un motivo y registra la excepción junto con la intervención

### Requirement: Retiro independiente de mentoría
El sistema SHALL permitir retirar una mentoría individual desde la entrada del docente sin afectar los demás equipos que acompaña.

#### Scenario: Retiro con varias asignaciones
- **WHEN** el administrador retira uno de los equipos de un docente con varias mentorías
- **THEN** el equipo seleccionado queda sin mentor y las demás asignaciones del docente permanecen vigentes

#### Scenario: Retiro fuera del período abierto
- **WHEN** el administrador retira una mentoría con la formación cerrada
- **THEN** el sistema exige un motivo y registra la excepción administrativa

### Requirement: Privacidad y consistencia operativa
El sistema MUST restringir el directorio docente y sus operaciones a administradores autorizados, SHALL limitar la consulta a los datos necesarios para esta vista y SHALL actualizar el directorio después de cada operación confirmada.

#### Scenario: Consulta administrativa autorizada
- **WHEN** una cuenta administradora solicita el directorio
- **THEN** el sistema entrega la proyección docente con disponibilidad y equipos sin incluir DNI, teléfono ni datos personales ajenos a la gestión de mentorías

#### Scenario: Consulta no administrativa
- **WHEN** una cuenta no administradora o una solicitud anónima intenta consultar u operar el directorio
- **THEN** el sistema deniega el acceso sin revelar docentes, equipos ni mentorías

#### Scenario: Operación confirmada
- **WHEN** finaliza una asignación, reemplazo o retiro
- **THEN** el sistema actualiza la información visible y anuncia el resultado sin exigir recargar toda la aplicación

#### Scenario: Operación fallida
- **WHEN** una operación no puede completarse
- **THEN** el sistema conserva el estado anterior, presenta un error accionable y permite reintentar
