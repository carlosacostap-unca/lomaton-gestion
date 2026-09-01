## Purpose

Administrar de forma privada las inscripciones importadas, proyectar un padrón operativo de candidatos estudiantes y docentes mentores, y mantener la condición FTCA con trazabilidad suficiente para validar la composición de los equipos.

## ADDED Requirements

### Requirement: Importación de candidatos desde CSV y Excel
El sistema SHALL permitir que un administrador cargue exportaciones CSV y Excel del formulario de inscripción con nombre completo, DNI, teléfono, email y vínculo con el nivel superior obligatorios, además de los campos académicos, declaración previa de equipo y consentimientos que correspondan a la rama respondida.

#### Scenario: Archivo compatible
- **WHEN** un administrador selecciona un archivo CSV o Excel con columnas reconocibles
- **THEN** el sistema reconoce los encabezados reales del formulario y presenta una vista previa normalizada antes de modificar el padrón

#### Scenario: Nombre completo importado
- **WHEN** una respuesta contiene el valor de “Apellido y nombres”
- **THEN** el sistema conserva el texto completo sin inferir automáticamente una separación entre nombre y apellido

#### Scenario: Campos de una rama no aplicable
- **WHEN** una respuesta deja vacíos los campos pertenecientes a otras ramas del formulario
- **THEN** el sistema no los considera errores mientras estén presentes los campos requeridos para el vínculo declarado

#### Scenario: Formato no compatible
- **WHEN** el archivo no es CSV ni Excel o no puede ser leído
- **THEN** el sistema rechaza la carga e informa el motivo sin modificar el padrón

### Requirement: Validación previa de filas
El sistema SHALL clasificar cada fila de la importación como válida o inválida y SHALL explicar los errores detectados.

#### Scenario: Faltan datos obligatorios
- **WHEN** una fila no contiene nombre completo, DNI, teléfono, vínculo declarado o un email válido
- **THEN** la fila queda excluida de la importación confirmable y muestra sus errores

#### Scenario: Respuesta con ramas contradictorias
- **WHEN** una respuesta de estudiante contiene simultáneamente datos de la rama FTCA y de la rama externa
- **THEN** la fila queda pendiente de revisión administrativa y no puede confirmarse hasta que el administrador resuelva su clasificación

#### Scenario: Email corregible
- **WHEN** una fila contiene un email con formato inválido
- **THEN** la vista previa permite al administrador corregirlo y vuelve a validar identidad y duplicados antes de habilitar su confirmación

#### Scenario: Confirmación de filas válidas
- **WHEN** el administrador confirma una vista previa que contiene filas válidas e inválidas
- **THEN** el sistema aplica solamente las filas válidas y conserva un resumen de las filas excluidas

#### Scenario: Cancelación de la vista previa
- **WHEN** el administrador cancela la importación antes de confirmarla
- **THEN** el padrón permanece sin cambios

### Requirement: Identidad única por email
El sistema SHALL normalizar los emails ignorando espacios exteriores y diferencias entre mayúsculas y minúsculas, SHALL normalizar el DNI para comparar identidad y SHALL mantener una única inscripción vigente y un único candidato por persona.

#### Scenario: Candidato nuevo
- **WHEN** una fila válida contiene un email que no existe en el padrón
- **THEN** el sistema crea un candidato con los valores importados

#### Scenario: Candidato existente
- **WHEN** una fila válida coincide con el email normalizado de un candidato existente
- **THEN** el sistema actualiza ese candidato sin crear un duplicado

#### Scenario: Candidato ausente en una importación posterior
- **WHEN** un candidato existente no aparece en un archivo importado posteriormente
- **THEN** el sistema conserva al candidato y sus relaciones existentes

#### Scenario: Reenvío idéntico
- **WHEN** el archivo contiene varias respuestas con el mismo email y DNI normalizados y los mismos datos
- **THEN** la vista previa las agrupa como un único registro vigente e informa los envíos repetidos

#### Scenario: Reenvío con cambios
- **WHEN** el archivo contiene varias respuestas con el mismo email y DNI normalizados pero valores diferentes
- **THEN** la vista previa propone como vigente la respuesta de fecha más reciente, muestra las diferencias y exige confirmación administrativa

#### Scenario: Identificadores en conflicto
- **WHEN** un email normalizado aparece asociado a distintos DNI o un DNI normalizado aparece asociado a distintos emails
- **THEN** la fila queda pendiente de revisión y el sistema no fusiona automáticamente las identidades

### Requirement: Estado FTCA de tres valores
El sistema SHALL representar la condición FTCA mediante los estados `confirmado`, `no_pertenece` y `pendiente`, y solamente `confirmado` SHALL satisfacer el requisito FTCA de un equipo.

#### Scenario: Valor FTCA afirmativo
- **WHEN** una fila válida declara “Estudiante FTYCA”
- **THEN** el candidato queda con estado `confirmado`

#### Scenario: Valor histórico Estudiante
- **WHEN** una fila válida declara el valor histórico “Estudiante” y no contiene datos de la rama externa
- **THEN** el candidato queda con estado `confirmado`

#### Scenario: Estudiante externo
- **WHEN** una fila válida declara “Estudiante externo”
- **THEN** el candidato queda con estado `no_pertenece`

#### Scenario: Valor ausente, ambiguo o contradictorio
- **WHEN** una fila no permite decidir la condición FTCA o completa simultáneamente las ramas FTCA y externa
- **THEN** el candidato queda con estado `pendiente` y la vista previa lo señala al administrador

### Requirement: Separación de datos privados y operativos
El sistema SHALL conservar la respuesta de inscripción con acceso administrativo restringido y SHALL exponer a los participantes solamente los datos mínimos necesarios para la formación de equipos.

#### Scenario: Datos privados importados
- **WHEN** se confirma una inscripción válida
- **THEN** DNI, teléfono, datos académicos, consentimientos y respuestas originales quedan disponibles solamente para administradores autorizados y procesos técnicos

#### Scenario: Consulta entre candidatos
- **WHEN** un candidato busca compañeros o consulta integrantes de un equipo
- **THEN** el sistema no expone DNI, teléfono, consentimientos ni respuestas privadas del formulario

#### Scenario: Consentimiento no respondido
- **WHEN** una rama del formulario no solicita explícitamente una autorización
- **THEN** el sistema conserva ese consentimiento como no informado y no lo infiere a partir de otras respuestas

### Requirement: Clasificación de docentes mentores
El sistema SHALL importar las respuestas con vínculo “Docente” como perfiles de mentor separados del padrón de candidatos.

#### Scenario: Docente importado
- **WHEN** una respuesta válida declara el vínculo “Docente”
- **THEN** el sistema conserva su departamento o descripción externa y su interés de mentoría sin habilitarle funciones de integración de equipos

#### Scenario: Docente con email autorizado administrativamente
- **WHEN** el email de un docente también pertenece a la lista administrativa
- **THEN** la persona obtiene solamente los permisos administrativos correspondientes y no se convierte por ello en candidato

### Requirement: Declaración previa de equipo no vinculante
El sistema SHALL conservar el estado y el texto libre de equipo declarado en el formulario únicamente como antecedente administrativo.

#### Scenario: Equipo declarado completo o parcial
- **WHEN** una inscripción indica que ya tiene equipo e identifica posibles integrantes
- **THEN** el sistema no crea equipos, membresías ni invitaciones automáticamente

#### Scenario: Administrador utiliza el antecedente
- **WHEN** un administrador consulta una inscripción con integrantes declarados
- **THEN** puede usar esa información para asistir la conformación aplicando las reglas normales de exclusividad, tamaño y consentimiento

### Requirement: Edición administrativa del candidato
El sistema SHALL permitir que un administrador corrija el nombre completo, email, clasificación, datos privados importados y estado FTCA de una inscripción, conservando la unicidad de identidad y auditando la intervención.

#### Scenario: Corrección válida
- **WHEN** un administrador guarda datos válidos para un candidato
- **THEN** el sistema actualiza el padrón y registra la intervención administrativa

#### Scenario: Email duplicado
- **WHEN** un administrador intenta asignar un email que ya pertenece a otro candidato
- **THEN** el sistema rechaza el cambio e identifica el conflicto

#### Scenario: Cambio FTCA afecta un equipo
- **WHEN** una edición elimina la única condición FTCA confirmada de un equipo completo
- **THEN** el sistema recalcula el estado del equipo, lo marca como inválido y advierte al administrador
