# hackathon-reporting Specification

## Purpose

Ofrecer a la organización una visión actual y exportable del padrón y de la conformación de equipos, restringida a usuarios administradores autorizados.

## Requirements

### Requirement: Consulta administrativa del estado del hackatón
El sistema SHALL permitir que los administradores consulten y filtren candidatos, equipos, miembros e invitaciones por sus estados relevantes, y SHALL incluir para cada equipo el desafío oficial seleccionado o indicar explícitamente que todavía no realizó una selección.

#### Scenario: Resumen general
- **WHEN** un administrador abre el área de seguimiento
- **THEN** el sistema muestra cantidades de candidatos disponibles, equipos completos, equipos incompletos y equipos inválidos

#### Scenario: Filtro de equipos problemáticos
- **WHEN** un administrador filtra equipos incompletos o inválidos
- **THEN** el sistema muestra solamente los equipos coincidentes y el motivo de su estado

#### Scenario: Equipo con desafío seleccionado
- **WHEN** un administrador consulta el listado o el detalle de un equipo que posee una selección válida
- **THEN** el sistema muestra el título canónico del único desafío elegido junto con los demás datos operativos del equipo

#### Scenario: Equipo sin desafío seleccionado
- **WHEN** un administrador consulta el listado o el detalle de un equipo sin selección
- **THEN** el sistema muestra un estado explícito “Sin seleccionar” sin omitir el equipo ni inventar un desafío

#### Scenario: Acceso no administrativo
- **WHEN** una cuenta no administradora intenta consultar la vista administrativa de equipos
- **THEN** el sistema deniega el acceso y no expone el desafío ni los demás datos administrativos

### Requirement: Exportación a CSV y Excel
El sistema SHALL permitir que un administrador exporte el estado vigente en formatos CSV y Excel, y SHALL incluir el desafío oficial seleccionado o el estado sin selección en las exportaciones de equipos.

#### Scenario: Exportación de candidatos
- **WHEN** un administrador exporta candidatos
- **THEN** el archivo incluye nombre, apellido, email, estado FTCA, disponibilidad y equipo actual si existe

#### Scenario: Exportación de equipos
- **WHEN** un administrador exporta equipos
- **THEN** el archivo incluye nombre del equipo, desafío seleccionado o estado sin selección, estado, integrantes aceptados, emails, condición FTCA y advertencias de validación

#### Scenario: Exportación exitosa sin datos
- **WHEN** el administrador exporta una vista que no contiene registros
- **THEN** el sistema genera un archivo válido con encabezados y sin filas de datos

### Requirement: Consistencia temporal del reporte
Cada exportación SHALL representar una instantánea coherente e SHALL indicar la fecha y hora de generación en el huso horario argentino.

#### Scenario: Cambios durante una exportación
- **WHEN** se modifican equipos mientras se prepara un archivo
- **THEN** el archivo conserva una única instantánea lógica y muestra su momento de generación

### Requirement: Seguridad del contenido exportado
El sistema SHALL producir archivos que preserven correctamente caracteres, separadores y valores textuales sin permitir que contenidos importados se interpreten como fórmulas ejecutables.

#### Scenario: Nombre con caracteres especiales
- **WHEN** un nombre contiene acentos, comas, saltos o comillas
- **THEN** el archivo exportado conserva el valor correctamente escapado

#### Scenario: Valor con prefijo de fórmula
- **WHEN** un dato comienza con un carácter que una hoja de cálculo podría interpretar como fórmula
- **THEN** el sistema neutraliza su ejecución manteniendo el contenido legible
