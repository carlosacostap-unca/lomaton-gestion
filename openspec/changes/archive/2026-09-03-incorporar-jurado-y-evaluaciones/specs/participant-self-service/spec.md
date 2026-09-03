## ADDED Requirements

### Requirement: Consulta del resultado publicado del equipo
El sistema SHALL permitir que un estudiante integrante de un equipo consulte los resultados consolidados de su propio equipo solamente después de su publicación administrativa y MUST impedirle consultar evaluaciones individuales o resultados de otros equipos.

#### Scenario: Resultado todavía no publicado
- **WHEN** el estudiante consulta su equipo antes de la publicación
- **THEN** el portal informa que los resultados todavía no están disponibles sin revelar puntajes ni avance

#### Scenario: Resultado publicado
- **WHEN** el estudiante consulta su equipo después de la publicación
- **THEN** el portal muestra los promedios de su equipo para los cinco criterios y el total ponderado general

#### Scenario: Privacidad de las evaluaciones
- **WHEN** el portal presenta un resultado publicado
- **THEN** omite la identidad de los jurados, sus puntajes individuales, borradores y metadatos internos

#### Scenario: Resultado de otro equipo
- **WHEN** el estudiante intenta consultar el resultado de un equipo al que no pertenece
- **THEN** el sistema deniega la consulta sin revelar si el resultado existe
