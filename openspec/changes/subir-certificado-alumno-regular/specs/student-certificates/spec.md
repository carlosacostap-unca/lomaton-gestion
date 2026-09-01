## Purpose

Permitir que cada candidato conserve un certificado PDF vigente de alumno regular y que la organización pueda consultarlo sin exponer documentación académica a otros participantes ni a accesos públicos.

## ADDED Requirements

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

### Requirement: Trazabilidad sin copiar el documento
El sistema SHALL registrar cada primera carga y reemplazo con actor, candidato, fecha y metadatos no sensibles del archivo, sin incluir el contenido, credenciales de almacenamiento ni una URL permanente.

#### Scenario: Primera carga auditada
- **WHEN** un candidato carga su primer certificado
- **THEN** el sistema agrega una entrada de auditoría identificando la acción y los metadatos permitidos

#### Scenario: Reemplazo auditado
- **WHEN** un candidato reemplaza su certificado vigente
- **THEN** el sistema registra el cambio de metadatos anterior y posterior sin conservar copias del PDF en la auditoría

### Requirement: Independencia respecto del estado FTCA
La carga o el reemplazo de un certificado SHALL NOT modificar automáticamente el estado FTCA, la pertenencia a un equipo ni la validez de su composición.

#### Scenario: Certificado cargado por candidato pendiente
- **WHEN** un candidato con estado FTCA pendiente carga un certificado
- **THEN** su estado FTCA y el estado de su equipo permanecen sin cambios hasta una intervención administrativa explícita
