# hackathon-administration Specification

## Purpose

Dar a los administradores control operativo sobre el período de formación y capacidad de resolver excepciones, manteniendo trazabilidad y reglas de integridad consistentes.

## Requirements

### Requirement: Configuración del plazo de formación
El sistema SHALL permitir que un administrador configure una fecha y hora límite interpretada en el huso horario `America/Argentina/Buenos_Aires`.

#### Scenario: Configuración válida
- **WHEN** el administrador guarda una fecha y hora válida
- **THEN** el sistema muestra el plazo vigente en hora argentina y lo utiliza para evaluar operaciones posteriores

#### Scenario: Modificación del plazo
- **WHEN** el administrador extiende o adelanta el plazo
- **THEN** la nueva fecha y hora entra en vigencia inmediatamente y la acción queda auditada

### Requirement: Bloqueo de operaciones de candidatos
El sistema SHALL bloquear las operaciones que alteran equipos o invitaciones cuando vence el plazo o cuando un administrador cierra manualmente la formación.

#### Scenario: Vencimiento automático
- **WHEN** la hora oficial alcanza el plazo configurado
- **THEN** los candidatos ya no pueden crear o disolver equipos, enviar o retirar invitaciones ni aceptar o rechazar invitaciones

#### Scenario: Cierre manual anticipado
- **WHEN** un administrador cierra manualmente la formación
- **THEN** se aplican inmediatamente las mismas restricciones del vencimiento

#### Scenario: Reapertura
- **WHEN** un administrador reabre la formación y el plazo no está vencido, o establece un nuevo plazo futuro
- **THEN** las operaciones de candidatos vuelven a estar disponibles

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

### Requirement: Advertencias de equipos inválidos
El sistema SHALL advertir a los administradores cuando una acción o actualización deje un equipo con una composición inválida.

#### Scenario: Equipo pierde validez
- **WHEN** cambia la membresía o condición FTCA y un equipo deja de cumplir alguna regla
- **THEN** el equipo queda identificado con el motivo de invalidez en el área administrativa

### Requirement: Auditoría administrativa inmutable
El sistema SHALL registrar las acciones administrativas relevantes con actor, fecha, tipo de acción, entidad afectada, valores anteriores y posteriores y, cuando corresponda, el motivo declarado.

#### Scenario: Acción auditada
- **WHEN** un administrador importa o modifica candidatos, cambia el plazo, altera el bloqueo o interviene sobre un equipo o invitación
- **THEN** el sistema agrega un registro de auditoría que no puede editarse ni eliminarse desde la aplicación

#### Scenario: Consulta de auditoría
- **WHEN** un administrador consulta el historial de una entidad
- **THEN** el sistema presenta sus intervenciones en orden cronológico con el actor identificado
