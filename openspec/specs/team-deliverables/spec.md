# team-deliverables Specification

## Purpose
Permitir que cada equipo reúna y presente sus productos finales en un paquete compartido, verificable y privado, con reglas de formato, acceso y cierre temporal explícitas.

## Requirements

### Requirement: Entrega única y compartida por equipo
El sistema SHALL mantener como máximo una entrega vigente por equipo y SHALL permitir que cualquier estudiante con membresía vigente consulte y gestione la entrega de su propio equipo mientras el plazo permanezca abierto. Todas las modificaciones MUST usar una versión esperada para impedir sobrescrituras silenciosas.

#### Scenario: Primera carga de un integrante
- **WHEN** un integrante vigente guarda el primer producto de su equipo dentro del plazo
- **THEN** el sistema crea la entrega compartida en estado borrador y la devuelve con su nueva versión

#### Scenario: Colaboración entre integrantes
- **WHEN** otro integrante vigente consulta la entrega después de una modificación
- **THEN** observa el mismo paquete y la versión confirmada más reciente

#### Scenario: Escritura concurrente
- **WHEN** un integrante intenta guardar sobre una versión que cambió desde su consulta
- **THEN** el sistema rechaza la versión obsoleta y solicita recargar sin sobrescribir la entrega vigente

#### Scenario: Persona ajena al equipo
- **WHEN** un participante intenta consultar o modificar la entrega de un equipo al que no pertenece
- **THEN** el sistema deniega la operación sin revelar productos, archivos, enlaces ni estado de la entrega

### Requirement: Contrato de productos y modalidades
El sistema MUST representar exactamente estos productos: Presentación obligatoria mediante un archivo o un enlace; Canvas obligatorio mediante un archivo; Informe obligatorio mediante un archivo; Evidencia del desarrollo alcanzado obligatoria mediante un archivo o un enlace; y Video opcional mediante un enlace. Cuando un producto admite archivo o enlace, la entrega SHALL conservar exactamente una de esas modalidades como vigente.

#### Scenario: Presentación mediante archivo
- **WHEN** el equipo guarda un archivo válido como Presentación
- **THEN** el sistema lo conserva como la única modalidad vigente de ese producto y elimina cualquier enlace de Presentación anterior

#### Scenario: Presentación mediante enlace
- **WHEN** el equipo guarda un enlace válido como Presentación
- **THEN** el sistema lo conserva como la única modalidad vigente de ese producto y retira cualquier archivo de Presentación anterior

#### Scenario: Canvas e Informe
- **WHEN** el equipo completa Canvas e Informe
- **THEN** el sistema acepta únicamente un archivo válido para cada producto y no ofrece una modalidad de enlace

#### Scenario: Evidencia mediante modalidad permitida
- **WHEN** el equipo guarda la Evidencia mediante un archivo válido o un enlace válido
- **THEN** el sistema conserva exactamente la modalidad elegida y considera presente el producto

#### Scenario: Video ausente
- **WHEN** el equipo no informa un enlace de Video
- **THEN** el sistema identifica el producto como opcional y no lo cuenta como faltante obligatorio

#### Scenario: Video mediante archivo
- **WHEN** el equipo intenta cargar un archivo como Video
- **THEN** el sistema rechaza la operación e informa que el Video admite solamente un enlace

### Requirement: Validación segura de archivos y enlaces
El sistema SHALL aceptar para Presentación archivos PDF, PPT o PPTX; para Canvas archivos PDF, PNG, JPG o JPEG; para Informe archivos PDF, DOC o DOCX; y para Evidencia archivos PDF, PNG, JPG, JPEG o ZIP. Cada archivo MUST respetar el máximo de carga configurado y coincidir en extensión, tipo declarado y contenido reconocido. Los enlaces MUST usar `https` o `http`, tener como máximo 2.048 caracteres y no podrán usar esquemas ejecutables o locales.

#### Scenario: Archivo válido
- **WHEN** un integrante carga un archivo cuyo formato, tipo y tamaño cumplen el contrato del producto
- **THEN** el sistema lo almacena como archivo protegido y conserva un nombre de descarga seguro

#### Scenario: Formato no permitido o contenido inconsistente
- **WHEN** la extensión, el tipo declarado o el contenido del archivo no coincide con los formatos permitidos para ese producto
- **THEN** el sistema rechaza el archivo sin reemplazar la versión vigente e informa los formatos admitidos

#### Scenario: Archivo demasiado grande
- **WHEN** el archivo supera el máximo configurado
- **THEN** el sistema rechaza la carga antes de persistirla e informa el límite aplicable

#### Scenario: Enlace inseguro
- **WHEN** un integrante envía un enlace con un esquema distinto de `https` o `http`, una dirección local no compartible o una longitud superior al máximo
- **THEN** el sistema rechaza el enlace sin modificar el producto vigente

### Requirement: Borrador, finalización y cierre automático
El sistema SHALL permitir guardar productos parciales en estado borrador y SHALL permitir finalizar una entrega solamente cuando estén presentes y válidos Presentación, Canvas, Informe y Evidencia. Una edición posterior a la finalización dentro del plazo MUST devolver la entrega a borrador hasta una nueva finalización. Al alcanzar la fecha y hora límite según el reloj del servidor, la entrega MUST quedar inmutable para sus integrantes.

#### Scenario: Guardado parcial
- **WHEN** el equipo guarda uno o más productos válidos pero todavía falta un producto obligatorio
- **THEN** el sistema conserva el borrador e identifica cuáles de los cuatro productos obligatorios faltan

#### Scenario: Finalización incompleta
- **WHEN** un integrante intenta finalizar sin los cuatro productos obligatorios válidos
- **THEN** el sistema rechaza la finalización, conserva el borrador e identifica cada faltante o error

#### Scenario: Finalización completa
- **WHEN** un integrante finaliza una entrega vigente con los cuatro productos obligatorios válidos
- **THEN** el sistema fija el estado finalizado y registra actor, fecha y versión de finalización sin exigir un Video

#### Scenario: Reemplazo previo al cierre
- **WHEN** un integrante reemplaza o retira un producto después de finalizar y el plazo todavía está abierto
- **THEN** el sistema guarda el cambio, vuelve la entrega a borrador y exige una nueva finalización

#### Scenario: Instante de vencimiento
- **WHEN** el reloj del servidor alcanza o supera la fecha y hora límite configurada
- **THEN** el sistema rechaza nuevas cargas, reemplazos, retiros y finalizaciones, y conserva en modo lectura la última versión guardada con su estado real

#### Scenario: Plazo no configurado
- **WHEN** un integrante intenta modificar o finalizar una entrega sin que exista una fecha límite de entrega configurada
- **THEN** el sistema rechaza la operación e informa que la organización todavía no habilitó el período de entrega

### Requirement: Consulta por administración y jurado
El sistema SHALL permitir que los administradores y los jurados activos consulten en modo lectura las entregas de todos los equipos, incluyendo borradores, entregas finalizadas y equipos sin entrega, con estado, faltantes y fechas claramente identificados. Ninguno de esos roles SHALL poder modificar los productos en nombre del equipo mediante esta capacidad.

#### Scenario: Supervisión administrativa
- **WHEN** un administrador consulta las entregas
- **THEN** el sistema lista todos los equipos y distingue sin entrega, borrador incompleto, borrador completo y finalizado, junto con los productos presentes y faltantes

#### Scenario: Consulta del jurado
- **WHEN** un jurado activo consulta un equipo
- **THEN** el sistema muestra en modo lectura los productos guardados, el estado y la última actualización, advirtiendo si el contenido todavía puede cambiar antes del plazo

#### Scenario: Cuenta sin rol autorizado
- **WHEN** una persona que no integra el equipo y no es administradora ni jurado activo intenta consultar su entrega
- **THEN** el sistema deniega el acceso sin confirmar la existencia de productos

### Requirement: Descarga privada y metadatos mínimos
Los archivos de las entregas MUST permanecer protegidos y SHALL descargarse solamente mediante una solicitud autenticada y autorizada para el producto concreto. Las respuestas SHALL exponer únicamente el nombre original seguro, tamaño, tipo, fecha de actualización y medio del producto, y MUST omitir nombres internos de almacenamiento, hashes, credenciales, tokens y URLs protegidas reutilizables.

#### Scenario: Descarga autorizada
- **WHEN** un integrante del equipo, administrador o jurado activo solicita un archivo de una entrega que puede consultar
- **THEN** el sistema revalida su rol, entrega el contenido con nombre y tipo seguros y no revela una URL permanente del almacenamiento

#### Scenario: Revocación de acceso
- **WHEN** una persona pierde la membresía o el rol autorizado antes de solicitar un archivo
- **THEN** el sistema deniega la descarga aunque esa persona haya consultado previamente los metadatos

#### Scenario: Enlace externo presentado
- **WHEN** un rol autorizado abre un producto almacenado como enlace
- **THEN** el sistema muestra el destino como contenido aportado por el equipo y lo abre de forma segura sin afirmar que verificó su disponibilidad, privacidad o contenido remoto

### Requirement: Trazabilidad de la entrega
El sistema MUST registrar de forma inmutable la creación, sustitución, retiro y finalización de productos con equipo, actor, fecha, tipo de producto, modalidad y versiones anterior y posterior, sin copiar el contenido de archivos, enlaces completos, credenciales ni tokens a la auditoría.

#### Scenario: Producto reemplazado
- **WHEN** un integrante reemplaza una modalidad o un archivo vigente
- **THEN** el sistema actualiza la entrega y agrega el evento de auditoría correspondiente de forma atómica

#### Scenario: Finalización auditada
- **WHEN** un integrante finaliza una entrega completa
- **THEN** el sistema registra la transición y su versión en la misma operación que fija el estado finalizado
