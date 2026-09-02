## MODIFIED Requirements

### Requirement: Intervención administrativa sobre equipos
El sistema SHALL permitir que un administrador cree, renombre, complete, reorganice y disuelva equipos, incorpore o retire miembros, resuelva invitaciones de estudiantes y asigne, reemplace o retire directamente el mentor de cada equipo. La administración SHALL poder seleccionar cualquier docente con perfil de mentor activo e interés afirmativo aunque ya acompañe a otros equipos.

#### Scenario: Aceptación administrativa
- **WHEN** un administrador acepta una invitación en representación de un candidato disponible
- **THEN** el sistema incorpora al candidato aplicando las mismas restricciones de exclusividad y tamaño

#### Scenario: Formación manual
- **WHEN** un administrador forma o modifica un equipo directamente
- **THEN** el sistema aplica la operación y recalcula su estado de conformación

#### Scenario: Asignación directa de mentor
- **WHEN** un administrador selecciona un docente elegible para un equipo sin mentor
- **THEN** el sistema crea inmediatamente una mentoría con origen administrativo y la registra en la auditoría

#### Scenario: Docente compartido entre equipos
- **WHEN** el docente seleccionado ya acompaña a uno o más equipos
- **THEN** el sistema permite la nueva asignación sin retirar ni alterar las anteriores

#### Scenario: Reemplazo de mentor
- **WHEN** un administrador reemplaza el mentor vigente de un equipo por otro docente elegible
- **THEN** el sistema deja exactamente una mentoría para ese equipo y audita los valores anterior y posterior

#### Scenario: Retiro de mentor
- **WHEN** un administrador retira la mentoría vigente de un equipo
- **THEN** el equipo queda sin mentor y las demás asignaciones del mismo docente permanecen intactas

#### Scenario: Docente no elegible
- **WHEN** un administrador intenta asignar un perfil docente inactivo o sin interés afirmativo de mentoría
- **THEN** el sistema rechaza la operación sin modificar la asignación vigente

#### Scenario: Intervención después del cierre
- **WHEN** un administrador realiza una intervención después del plazo o del cierre manual
- **THEN** el sistema permite la operación, exige un motivo y deja constancia de la excepción

#### Scenario: Intervención incompatible
- **WHEN** una acción administrativa intentaría dejar un candidato en dos equipos, superar cuatro miembros o crear una segunda mentoría sin reemplazo para el mismo equipo
- **THEN** el sistema rechaza la acción e informa la regla incumplida
