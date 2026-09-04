## Purpose

Permitir que cada equipo elija un único desafío oficial del hackatón, comparta esa selección entre sus integrantes y la haga visible para la organización.

## ADDED Requirements

### Requirement: Catálogo cerrado de desafíos
El sistema SHALL reconocer exactamente los cinco desafíos oficiales del hackatón mediante identificadores estables y títulos canónicos, y MUST rechazar cualquier valor que no pertenezca a ese catálogo.

#### Scenario: Opciones disponibles para un equipo
- **WHEN** un integrante vigente consulta la sección de desafío de su equipo
- **THEN** el sistema presenta solamente “Identificación de problemáticas operativas mediante la obtención y análisis de imágenes”, “Tránsito por planta”, “Mejoras en sistemas de medición”, “Consumo de materiales en almacenes y control patrimonial” y “Edificios sustentables y mejora de espacios”

#### Scenario: Valor ajeno al catálogo
- **WHEN** un cliente intenta guardar un identificador diferente de los cinco identificadores oficiales
- **THEN** el sistema rechaza la operación y conserva la selección anterior del equipo

### Requirement: Selección única compartida por equipo
El sistema SHALL permitir que un equipo conserve como máximo un desafío vigente y SHALL hacer que todos sus integrantes observen la misma selección.

#### Scenario: Primera selección
- **WHEN** un estudiante con membresía vigente elige uno de los cinco desafíos para un equipo todavía sin selección
- **THEN** el sistema guarda ese desafío como la única selección vigente del equipo y devuelve una confirmación comprensible

#### Scenario: Cambio de selección
- **WHEN** un estudiante con membresía vigente elige un desafío oficial distinto del actualmente seleccionado
- **THEN** el sistema reemplaza la selección anterior y las consultas posteriores muestran solamente el nuevo desafío

#### Scenario: Reenvío de la selección vigente
- **WHEN** un integrante vuelve a guardar el desafío que el equipo ya tiene seleccionado
- **THEN** la operación finaliza correctamente sin crear selecciones duplicadas

### Requirement: Autorización basada en membresía vigente
El sistema MUST permitir la actualización del desafío solamente a un estudiante autenticado que mantenga una membresía vigente en el equipo afectado.

#### Scenario: Integrante autorizado
- **WHEN** un estudiante autenticado con membresía vigente actualiza el desafío de su propio equipo
- **THEN** el sistema acepta la operación si el valor pertenece al catálogo oficial

#### Scenario: Persona ajena al equipo
- **WHEN** un estudiante intenta actualizar el desafío de un equipo al que no pertenece
- **THEN** el sistema deniega la operación sin revelar ni modificar la selección del equipo

#### Scenario: Mentor o usuario sin perfil estudiantil
- **WHEN** un mentor o una cuenta autenticada sin membresía estudiantil intenta actualizar el desafío
- **THEN** el sistema deniega la operación y conserva el estado del equipo

### Requirement: Estado inicial compatible con equipos existentes
El sistema SHALL admitir equipos sin desafío seleccionado y SHALL presentar ese estado de forma explícita hasta que un integrante realice una elección válida.

#### Scenario: Equipo previo a la funcionalidad
- **WHEN** se consulta un equipo cuyo registro no contiene un desafío válido
- **THEN** el sistema informa que todavía no hay un desafío seleccionado y mantiene disponibles las cinco opciones para un integrante autorizado
