## ADDED Requirements

### Requirement: Autogestión de la entrega del equipo
El sistema SHALL mostrar a cada estudiante con membresía vigente la entrega compartida de su equipo, sus cinco productos, el estado, los faltantes y la fecha y hora límite en `America/Argentina/Buenos_Aires`, y SHALL ofrecer las acciones de carga, enlace, reemplazo, retiro y finalización solamente mientras el plazo esté abierto.

#### Scenario: Equipo sin entrega
- **WHEN** un integrante abre su portal antes de la primera carga
- **THEN** el sistema muestra los cinco productos, distingue los cuatro obligatorios del Video opcional e informa el plazo vigente

#### Scenario: Borrador del equipo
- **WHEN** un integrante abre una entrega parcial
- **THEN** el sistema muestra los productos confirmados, los faltantes obligatorios, su versión y las acciones todavía disponibles

#### Scenario: Entrega finalizada dentro del plazo
- **WHEN** un integrante abre una entrega finalizada antes del cierre
- **THEN** el sistema identifica la fecha de finalización y permite reemplazar productos advirtiendo que el cambio devolverá la entrega a borrador

#### Scenario: Entrega cerrada por vencimiento
- **WHEN** un integrante abre su entrega después del límite
- **THEN** el portal presenta la última versión en modo lectura, su estado real y la fecha de cierre sin ofrecer controles de modificación

#### Scenario: Estudiante sin equipo
- **WHEN** un estudiante que no posee membresía vigente consulta el portal
- **THEN** el sistema informa que necesita integrar un equipo y no crea ni expone una entrega
