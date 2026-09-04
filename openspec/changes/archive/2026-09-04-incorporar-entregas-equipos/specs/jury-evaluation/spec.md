## ADDED Requirements

### Requirement: Consulta de entregables por el jurado
El sistema SHALL permitir que cada jurado activo consulte en modo lectura la entrega vigente de todos los equipos desde su portal, con estado, productos, faltantes y fechas, sin revelar datos de auditoría internos ni otorgar acciones de modificación.

#### Scenario: Equipo con entrega finalizada
- **WHEN** un jurado abre un equipo cuya entrega está finalizada
- **THEN** el portal identifica la finalización y permite abrir o descargar cada producto disponible

#### Scenario: Equipo con borrador
- **WHEN** un jurado abre un equipo cuya entrega permanece en borrador
- **THEN** el portal muestra los productos actualmente guardados y advierte que no se trata de una entrega finalizada y que puede cambiar mientras el plazo esté abierto

#### Scenario: Equipo sin entrega
- **WHEN** un jurado abre un equipo que todavía no cargó productos
- **THEN** el portal informa explícitamente que no posee entrega sin inventar enlaces ni archivos

#### Scenario: Pérdida del rol
- **WHEN** una cuenta deja de corresponder a un jurado activo
- **THEN** el sistema deniega nuevas consultas y descargas de entregables aunque conserve una sesión previa
