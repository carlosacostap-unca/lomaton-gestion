## MODIFIED Requirements

### Requirement: Consulta del resultado publicado del equipo
El sistema SHALL permitir que un estudiante integrante de un equipo consulte los resultados consolidados de su propio equipo solamente después de su publicación administrativa y MUST impedirle consultar aspectos, observaciones, evaluaciones individuales o resultados de otros equipos.

#### Scenario: Resultado todavía no publicado
- **WHEN** el estudiante consulta su equipo antes de la publicación
- **THEN** el portal informa que los resultados todavía no están disponibles sin revelar puntajes ni avance

#### Scenario: Resultado publicado con la nueva planilla
- **WHEN** el estudiante consulta un resultado publicado con la matriz de trece aspectos
- **THEN** el portal muestra los cinco promedios consolidados de su equipo en escala 1–5 y el total ponderado general sobre 100

#### Scenario: Resultado publicado
- **WHEN** el estudiante consulta un resultado de su equipo que la administración ya publicó
- **THEN** el portal presenta el resultado según la versión de rúbrica que quedó congelada para ese ciclo

#### Scenario: Resultado histórico publicado
- **WHEN** el estudiante consulta un resultado publicado con la matriz anterior
- **THEN** el portal mantiene la escala histórica 0–10 y la identifica sin convertirla a la nueva escala

#### Scenario: Privacidad de las evaluaciones
- **WHEN** el portal presenta un resultado publicado
- **THEN** omite la identidad de los jurados, los puntajes y observaciones por aspecto, sus evaluaciones individuales, borradores y metadatos internos

#### Scenario: Resultado de otro equipo
- **WHEN** el estudiante intenta consultar el resultado de un equipo al que no pertenece
- **THEN** el sistema deniega la consulta sin revelar si el resultado existe
