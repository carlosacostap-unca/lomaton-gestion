## ADDED Requirements

### Requirement: Configuración del plazo de entrega
El sistema SHALL permitir que un administrador configure y modifique una fecha y hora límite de entrega interpretada en el huso horario `America/Argentina/Buenos_Aires`, independiente del plazo de formación de equipos. El valor vigente SHALL aplicarse inmediatamente a las operaciones posteriores y cada cambio MUST quedar auditado con actor y valores anterior y posterior.

#### Scenario: Primera configuración
- **WHEN** el administrador guarda una fecha y hora futura válida para la entrega
- **THEN** el sistema muestra el plazo vigente en hora argentina y habilita las operaciones de entrega hasta ese instante

#### Scenario: Extensión del plazo
- **WHEN** el administrador reemplaza un plazo vencido por una fecha y hora futura
- **THEN** las operaciones de los equipos vuelven a quedar disponibles inmediatamente y la extensión queda auditada

#### Scenario: Adelanto del plazo
- **WHEN** el administrador establece un nuevo límite que ya fue alcanzado por el reloj del servidor
- **THEN** el sistema advierte el cierre inmediato, exige confirmación explícita y bloquea las operaciones al confirmar

#### Scenario: Independencia del período de formación
- **WHEN** el administrador modifica el plazo de entrega
- **THEN** el plazo y la apertura de formación de equipos permanecen sin cambios
