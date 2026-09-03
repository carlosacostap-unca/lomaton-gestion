# student-certificates Specification

## Purpose

Permitir que cada candidato conserve un certificado PDF vigente de alumno regular y que la organización pueda consultarlo sin exponer documentación académica a otros participantes ni a accesos públicos.

## Requirements

### Requirement: Carga de certificado por el candidato
El sistema SHALL permitir que un usuario autenticado con un candidato activo cargue un único certificado vigente de alumno regular desde su panel.

#### Scenario: Primera carga válida
- **WHEN** un candidato activo selecciona un PDF válido dentro del límite permitido y confirma la carga
- **THEN** el sistema conserva el certificado asociado exclusivamente a ese candidato y muestra su nombre de archivo y fecha de carga

#### Scenario: Usuario sin candidato
- **WHEN** un usuario exclusivamente administrador o sin candidato activo intenta cargar un certificado propio
- **THEN** el sistema rechaza la operación sin crear un registro documental

### Requirement: Validación estricta del PDF
El sistema MUST aceptar solamente archivos con extensión `.pdf`, tipo declarado de PDF, contenido cuya firma corresponda a un PDF y tamaño no mayor al límite configurado, cuyo valor predeterminado SHALL ser 10 MiB.

#### Scenario: Archivo PDF válido
- **WHEN** el nombre, el tipo declarado, la firma del contenido y el tamaño cumplen las restricciones
- **THEN** el sistema acepta el archivo para su persistencia

#### Scenario: Extensión o tipo incorrecto
- **WHEN** el archivo no posee extensión `.pdf` o declara un tipo diferente de PDF
- **THEN** el sistema rechaza la carga con un mensaje accionable y no modifica el certificado vigente

#### Scenario: Contenido que no es PDF
- **WHEN** un archivo renombrado como PDF no contiene la firma esperada de un documento PDF
- **THEN** el sistema rechaza la carga y no persiste su contenido

#### Scenario: Archivo excedido
- **WHEN** el archivo supera el límite configurado
- **THEN** el sistema rechaza la carga antes de almacenarlo e informa el límite admitido

### Requirement: Reemplazo seguro del certificado vigente
El sistema SHALL permitir que el candidato reemplace su certificado y SHALL mantener como máximo un certificado vigente por candidato.

#### Scenario: Reemplazo exitoso
- **WHEN** un candidato con certificado vigente carga un nuevo PDF válido
- **THEN** el nuevo archivo y sus metadatos sustituyen al anterior y la interfaz muestra solamente la versión vigente

#### Scenario: Fallo durante el reemplazo
- **WHEN** la validación o el almacenamiento del nuevo archivo falla
- **THEN** el certificado anterior permanece vigente y disponible

#### Scenario: Cargas concurrentes
- **WHEN** dos cargas intentan crear o reemplazar simultáneamente el certificado del mismo candidato
- **THEN** el sistema conserva una única versión vigente y devuelve un resultado coherente para cada solicitud

### Requirement: Acceso privado al documento
El sistema MUST permitir consultar o descargar un certificado solamente a su candidato propietario y a administradores autorizados, sin publicar URLs permanentes ni exponer el documento en consultas operativas.

#### Scenario: Descarga del propio certificado
- **WHEN** el candidato solicita descargar su certificado vigente
- **THEN** el sistema entrega el PDF autenticado con un nombre de archivo seguro

#### Scenario: Consulta administrativa
- **WHEN** un administrador autorizado consulta un candidato con certificado
- **THEN** el sistema muestra los metadatos permitidos y habilita la descarga autenticada del documento

#### Scenario: Otro candidato intenta acceder
- **WHEN** un candidato solicita el certificado de otra persona
- **THEN** el sistema deniega el acceso sin revelar si el documento existe

#### Scenario: Acceso anónimo
- **WHEN** una solicitud no autenticada intenta consultar metadatos o contenido de un certificado
- **THEN** el sistema deniega la solicitud sin devolver datos documentales

#### Scenario: Reportes y búsquedas generales
- **WHEN** se consultan búsquedas operativas o se exportan candidatos y equipos
- **THEN** el contenido del certificado y su ubicación de almacenamiento no forman parte de la respuesta

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
