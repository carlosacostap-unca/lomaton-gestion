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
El sistema SHALL permitir que un administrador consulte los equipos mediante un listado resumido y acceda al detalle de un único equipo para crearlo, renombrarlo, completarlo, reorganizarlo o disolverlo, incorporar o retirar miembros, resolver invitaciones de estudiantes y asignar, reemplazar o retirar directamente su mentor. La administración SHALL poder seleccionar cualquier docente con perfil de mentor activo e interés afirmativo aunque ya acompañe a otros equipos.

#### Scenario: Listado resumido
- **WHEN** un administrador abre la sección Equipos
- **THEN** el sistema lista cada equipo con nombre, estado, cantidad de integrantes, condición FTCA, mentor y advertencias relevantes sin expandir sus formularios operativos

#### Scenario: Búsqueda y filtros
- **WHEN** el administrador busca por nombre o filtra los equipos por su estado relevante
- **THEN** el sistema presenta solamente los resúmenes coincidentes e informa cuando no existen resultados

#### Scenario: Detalle individual
- **WHEN** el administrador elige gestionar un equipo del listado
- **THEN** el sistema muestra solamente el detalle de ese equipo con responsable, integrantes, invitaciones, mentor y acciones administrativas aplicables

#### Scenario: Regreso al listado
- **WHEN** el administrador finaliza o abandona el detalle de un equipo
- **THEN** el sistema permite volver al listado conservando un contexto comprensible de búsqueda y filtros

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

### Requirement: Configuración del plazo de entrega
El sistema SHALL permitir que un administrador configure y modifique una fecha y hora límite de entrega interpretada en el huso horario `America/Argentina/Buenos_Aires`, independiente del plazo de formación de equipos. El valor vigente SHALL aplicarse inmediatamente a las operaciones posteriores y cada cambio MUST quedar auditado con actor y valores anterior y posterior.

#### Scenario: Primera configuración
- **WHEN** el administrador guarda una fecha y hora futura válida para la entrega
- **THEN** el sistema muestra el plazo vigente en hora argentina y habilita las operaciones de entrega hasta ese instante

#### Scenario: Extensión del plazo
- **WHEN** el administrador reemplaza un plazo vencido por una fecha y hora futura
- **THEN** las operaciones de los equipos vuelven a quedar disponibles inmediatamente y la extensión queda auditada

#### Scenario: Adelanto del plazo
- **WHEN** el administrador establece un nuevo límite que ya fue alcanzado por el reloj del servidor
- **THEN** el sistema advierte el cierre inmediato, exige confirmación explícita y bloquea las operaciones al confirmar

#### Scenario: Independencia del período de formación
- **WHEN** el administrador modifica el plazo de entrega
- **THEN** el plazo y la apertura de formación de equipos permanecen sin cambios
