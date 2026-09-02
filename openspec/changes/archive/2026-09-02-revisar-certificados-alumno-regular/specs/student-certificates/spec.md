## ADDED Requirements

### Requirement: Ciclo de revisión del certificado vigente
El sistema SHALL asignar al certificado vigente exactamente uno de los estados `pending`, `approved` o `rejected`, y SHALL permitir que solamente un administrador autorizado registre o corrija una decisión sobre la versión vigente.

#### Scenario: Primera carga pendiente
- **WHEN** un candidato carga por primera vez un PDF válido
- **THEN** el certificado queda en estado `pending` sin revisor, fecha de revisión ni motivo de rechazo

#### Scenario: Certificado existente al desplegar el cambio
- **WHEN** la migración encuentra un certificado creado antes de existir el ciclo de revisión
- **THEN** lo conserva y lo clasifica como `pending` sin inventar una decisión administrativa

#### Scenario: Aprobación administrativa
- **WHEN** un administrador autorizado aprueba la versión vigente de un certificado pendiente o rechazado
- **THEN** el sistema registra `approved`, el actor y la fecha de revisión, y deja vacío el motivo de rechazo

#### Scenario: Rechazo administrativo
- **WHEN** un administrador autorizado rechaza la versión vigente e informa un motivo no vacío apto para el candidato
- **THEN** el sistema registra `rejected`, el actor, la fecha y el motivo normalizado

#### Scenario: Rechazo sin motivo
- **WHEN** un administrador intenta rechazar un certificado sin un motivo válido
- **THEN** el sistema rechaza la operación y conserva intacta la decisión anterior

#### Scenario: Corrección de una decisión
- **WHEN** un administrador cambia una decisión vigente aportando los datos requeridos para el nuevo estado
- **THEN** el sistema conserva solamente la decisión actual y audita la transición desde el estado anterior

### Requirement: Decisiones ligadas a la versión revisada
El sistema MUST impedir que una aprobación o un rechazo se aplique a un archivo diferente del que el administrador revisó.

#### Scenario: Reemplazo después de una decisión
- **WHEN** el candidato reemplaza un certificado aprobado o rechazado por un nuevo PDF válido
- **THEN** el nuevo archivo queda en `pending` y se eliminan del estado vigente el revisor, la fecha y el motivo anteriores

#### Scenario: Reemplazo mientras el administrador decide
- **WHEN** el certificado cambia después de que el administrador lo consultó y antes de confirmar su decisión
- **THEN** el sistema devuelve un conflicto, no aplica la decisión obsoleta y exige revisar la versión vigente

#### Scenario: Reintento idéntico
- **WHEN** se repite una solicitud con la misma decisión, motivo y versión que ya están vigentes
- **THEN** el sistema devuelve el resultado actual sin crear una segunda transición de auditoría

### Requirement: Cola administrativa de revisión
El sistema SHALL permitir que los administradores consulten certificados por estado de revisión y accedan desde cada resultado a sus metadatos permitidos, descarga privada y acciones válidas.

#### Scenario: Filtro de pendientes
- **WHEN** un administrador filtra la cola por `pending`
- **THEN** el sistema muestra solamente certificados vigentes pendientes con la identidad operativa necesaria para revisarlos

#### Scenario: Filtro de decididos
- **WHEN** un administrador filtra por `approved` o `rejected`
- **THEN** el sistema muestra solamente los certificados cuyo estado vigente coincide

#### Scenario: Acceso no administrativo
- **WHEN** un candidato o una solicitud anónima intenta consultar la cola de revisión
- **THEN** el sistema deniega el acceso sin exponer certificados, estados de terceros ni motivos

### Requirement: Resultado visible para el candidato
El sistema SHALL mostrar al candidato el estado de revisión de su certificado vigente y SHALL revelar el motivo únicamente cuando ese certificado esté rechazado.

#### Scenario: Certificado pendiente
- **WHEN** el candidato consulta un certificado en `pending`
- **THEN** la interfaz informa que está pendiente de revisión sin mostrar datos del revisor

#### Scenario: Certificado aprobado
- **WHEN** el candidato consulta un certificado en `approved`
- **THEN** la interfaz informa que fue aprobado sin cambiar su estado FTCA

#### Scenario: Certificado rechazado
- **WHEN** el candidato consulta un certificado en `rejected`
- **THEN** la interfaz muestra el motivo vigente y permite reemplazar el PDF para iniciar una nueva revisión

#### Scenario: Datos internos de revisión
- **WHEN** el candidato consulta sus metadatos
- **THEN** la respuesta no incluye identificadores internos del revisor, hashes ni campos de auditoría

## MODIFIED Requirements

### Requirement: Trazabilidad sin copiar el documento
El sistema SHALL registrar cada primera carga, reemplazo, decisión administrativa y reinicio de revisión con actor, candidato, fecha, versión y metadatos no sensibles, sin incluir el contenido, credenciales de almacenamiento ni una URL permanente.

#### Scenario: Primera carga auditada
- **WHEN** un candidato carga su primer certificado
- **THEN** el sistema agrega una entrada de auditoría identificando la acción, los metadatos permitidos y el estado inicial `pending`

#### Scenario: Reemplazo auditado
- **WHEN** un candidato reemplaza su certificado vigente
- **THEN** el sistema registra el cambio de metadatos y el reinicio de revisión sin conservar copias del PDF en la auditoría

#### Scenario: Decisión auditada
- **WHEN** un administrador aprueba, rechaza o corrige una decisión
- **THEN** el sistema registra el actor y los estados anterior y posterior sin copiar el PDF ni exponer el motivo fuera de los accesos privados autorizados

### Requirement: Independencia respecto del estado FTCA
La carga, el reemplazo, la aprobación o el rechazo de un certificado SHALL NOT modificar automáticamente el estado FTCA, la pertenencia a un equipo ni la validez de su composición.

#### Scenario: Certificado cargado por candidato pendiente
- **WHEN** un candidato con estado FTCA pendiente carga un certificado
- **THEN** su estado FTCA y el estado de su equipo permanecen sin cambios hasta una intervención administrativa explícita sobre el padrón

#### Scenario: Certificado aprobado
- **WHEN** un administrador aprueba el certificado de un candidato con FTCA pendiente o no perteneciente
- **THEN** la decisión documental queda registrada sin alterar FTCA ni recalcular equipos

#### Scenario: Certificado rechazado
- **WHEN** un administrador rechaza el certificado de un integrante de equipo
- **THEN** la membresía y la proyección del equipo permanecen sin cambios
