## ADDED Requirements

### Requirement: Visualización administrativa integrada del PDF
El sistema SHALL permitir que un administrador autorizado visualice el certificado PDF vigente dentro de la plataforma sin descargarlo previamente al disco, y SHALL mantener disponible la descarga autenticada como acción independiente.

#### Scenario: Apertura del visor
- **WHEN** el administrador selecciona un certificado vigente desde la cola de revisión
- **THEN** el sistema obtiene el PDF mediante una solicitud autenticada y lo muestra junto con sus metadatos y acciones de revisión

#### Scenario: Descarga opcional
- **WHEN** el administrador necesita conservar una copia local del certificado visible
- **THEN** puede descargar el mismo PDF con su nombre de archivo seguro sin abandonar la revisión

#### Scenario: Cambio de certificado seleccionado
- **WHEN** el administrador pasa a otro certificado o cierra el detalle
- **THEN** el sistema descarta el recurso temporal del PDF anterior y muestra únicamente el documento vigente seleccionado

#### Scenario: Fallo de visualización
- **WHEN** el navegador no puede representar el PDF o la recuperación autenticada falla
- **THEN** el sistema informa el problema y mantiene disponible un reintento o la descarga, sin aplicar una decisión documental

#### Scenario: Acceso no autorizado al contenido
- **WHEN** una persona no administradora intenta solicitar la vista del certificado de otro candidato
- **THEN** el sistema deniega el acceso sin exponer el PDF ni una ubicación permanente

## MODIFIED Requirements

### Requirement: Cola administrativa de revisión
El sistema SHALL permitir que los administradores consulten certificados por estado de revisión en un listado resumido y accedan desde cada resultado a un único detalle seleccionado con sus metadatos permitidos, visualización privada, descarga y acciones válidas.

#### Scenario: Filtro de pendientes
- **WHEN** un administrador filtra la cola por `pending`
- **THEN** el sistema muestra solamente certificados vigentes pendientes con la identidad operativa necesaria para revisarlos

#### Scenario: Filtro de decididos
- **WHEN** un administrador filtra por `approved` o `rejected`
- **THEN** el sistema muestra solamente los certificados cuyo estado vigente coincide

#### Scenario: Selección para revisión
- **WHEN** el administrador selecciona un resultado de la cola
- **THEN** el sistema muestra su detalle y PDF sin expandir simultáneamente los demás certificados

#### Scenario: Decisión desde el detalle
- **WHEN** el administrador aprueba o rechaza la versión visible
- **THEN** el sistema actualiza la cola y conserva un contexto claro para continuar con la siguiente revisión

#### Scenario: Acceso no administrativo
- **WHEN** un candidato o una solicitud anónima intenta consultar la cola de revisión
- **THEN** el sistema deniega el acceso sin exponer certificados, estados de terceros ni motivos
