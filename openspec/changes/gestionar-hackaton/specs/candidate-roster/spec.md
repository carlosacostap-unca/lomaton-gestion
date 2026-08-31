## Purpose

Administrar un padrón confiable de candidatos importados, identificados por email, y mantener su condición FTCA con trazabilidad suficiente para validar la composición de los equipos.

## ADDED Requirements

### Requirement: Importación de candidatos desde CSV y Excel
El sistema SHALL permitir que un administrador cargue archivos CSV y Excel con nombre, apellido y email obligatorios, y con un valor FTCA opcional.

#### Scenario: Archivo compatible
- **WHEN** un administrador selecciona un archivo CSV o Excel con columnas reconocibles
- **THEN** el sistema presenta una vista previa de sus filas antes de modificar el padrón

#### Scenario: Formato no compatible
- **WHEN** el archivo no es CSV ni Excel o no puede ser leído
- **THEN** el sistema rechaza la carga e informa el motivo sin modificar el padrón

### Requirement: Validación previa de filas
El sistema SHALL clasificar cada fila de la importación como válida o inválida y SHALL explicar los errores detectados.

#### Scenario: Faltan datos obligatorios
- **WHEN** una fila no contiene nombre, apellido o un email válido
- **THEN** la fila queda excluida de la importación confirmable y muestra sus errores

#### Scenario: Confirmación de filas válidas
- **WHEN** el administrador confirma una vista previa que contiene filas válidas e inválidas
- **THEN** el sistema aplica solamente las filas válidas y conserva un resumen de las filas excluidas

#### Scenario: Cancelación de la vista previa
- **WHEN** el administrador cancela la importación antes de confirmarla
- **THEN** el padrón permanece sin cambios

### Requirement: Identidad única por email
El sistema SHALL normalizar los emails ignorando espacios exteriores y diferencias entre mayúsculas y minúsculas, y SHALL mantener un único candidato por email normalizado.

#### Scenario: Candidato nuevo
- **WHEN** una fila válida contiene un email que no existe en el padrón
- **THEN** el sistema crea un candidato con los valores importados

#### Scenario: Candidato existente
- **WHEN** una fila válida coincide con el email normalizado de un candidato existente
- **THEN** el sistema actualiza ese candidato sin crear un duplicado

#### Scenario: Candidato ausente en una importación posterior
- **WHEN** un candidato existente no aparece en un archivo importado posteriormente
- **THEN** el sistema conserva al candidato y sus relaciones existentes

### Requirement: Estado FTCA de tres valores
El sistema SHALL representar la condición FTCA mediante los estados `confirmado`, `no_pertenece` y `pendiente`, y solamente `confirmado` SHALL satisfacer el requisito FTCA de un equipo.

#### Scenario: Valor FTCA afirmativo
- **WHEN** una fila válida declara de forma reconocible que el candidato pertenece a FTCA
- **THEN** el candidato queda con estado `confirmado`

#### Scenario: Valor FTCA negativo
- **WHEN** una fila válida declara de forma reconocible que el candidato no pertenece a FTCA
- **THEN** el candidato queda con estado `no_pertenece`

#### Scenario: Valor FTCA ausente o ambiguo
- **WHEN** una fila válida no incluye el valor FTCA o su contenido no permite decidir afirmativa o negativamente
- **THEN** el candidato queda con estado `pendiente` y la vista previa lo señala al administrador

### Requirement: Edición administrativa del candidato
El sistema SHALL permitir que un administrador corrija el nombre, apellido, email y estado FTCA de un candidato, conservando la unicidad del email.

#### Scenario: Corrección válida
- **WHEN** un administrador guarda datos válidos para un candidato
- **THEN** el sistema actualiza el padrón y registra la intervención administrativa

#### Scenario: Email duplicado
- **WHEN** un administrador intenta asignar un email que ya pertenece a otro candidato
- **THEN** el sistema rechaza el cambio e identifica el conflicto

#### Scenario: Cambio FTCA afecta un equipo
- **WHEN** una edición elimina la única condición FTCA confirmada de un equipo completo
- **THEN** el sistema recalcula el estado del equipo, lo marca como inválido y advierte al administrador

