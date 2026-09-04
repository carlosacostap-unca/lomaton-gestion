# participant-self-service Specification

## Purpose

Permitir que estudiantes y docentes autenticados consulten su propia inscripción, mantengan actualizados los datos autorizados y accedan a un portal adaptado a su rol sin exponer información privada de terceros.

## Requirements

### Requirement: Portal adaptado al rol vigente
El sistema SHALL presentar a cada participante autenticado las funciones que corresponden al vínculo vigente de su inscripción, sin convertir a un docente en candidato ni a un estudiante en mentor.

#### Scenario: Portal de estudiante
- **WHEN** un estudiante activo accede al portal
- **THEN** el sistema muestra su perfil, su certificado de alumno regular, su equipo y sus invitaciones estudiantiles según correspondan

#### Scenario: Portal de docente
- **WHEN** un docente con perfil de mentor activo accede al portal
- **THEN** el sistema muestra su perfil docente, sus invitaciones de mentoría y el equipo que acompaña si posee una asignación aceptada

#### Scenario: Identidad con permisos administrativos
- **WHEN** un participante también es administrador
- **THEN** el sistema conserva el acceso separado al área administrativa y aplica el rol de su inscripción dentro del portal de participante

#### Scenario: Función incompatible con el rol
- **WHEN** un docente intenta utilizar una función reservada a candidatos o un estudiante intenta resolver una mentoría docente
- **THEN** el sistema deniega la operación sin modificar datos

### Requirement: Consulta privada de la inscripción propia
El sistema SHALL permitir que un participante autenticado consulte los datos normalizados de su propia inscripción y MUST impedir que reciba respuestas originales, metadatos técnicos o inscripciones de terceros.

#### Scenario: Consulta propia válida
- **WHEN** un participante vinculado solicita su perfil
- **THEN** el sistema devuelve sus datos personales y académicos permitidos junto con la indicación de cuáles son editables

#### Scenario: Datos internos excluidos
- **WHEN** el sistema construye la respuesta del perfil propio
- **THEN** omite la fuente original, metadatos de importación, identificadores de terceros y campos de auditoría internos

#### Scenario: Consulta sin inscripción vinculada
- **WHEN** una identidad autenticada sin inscripción vinculada intenta consultar un perfil de participante
- **THEN** el sistema deniega la consulta sin revelar la existencia de otras inscripciones

### Requirement: Edición acotada por rol
El sistema SHALL aceptar únicamente una lista explícita de campos autoeditables: teléfono para todo participante; unidad académica, carrera y departamento para estudiantes cuando correspondan; y departamento, descripción externa e interés de mentoría para docentes.

#### Scenario: Estudiante actualiza datos autorizados
- **WHEN** un estudiante envía valores válidos para sus campos académicos o de contacto editables
- **THEN** el sistema normaliza y guarda esos valores en su inscripción y actualiza su proyección operativa cuando corresponda

#### Scenario: Docente actualiza datos autorizados
- **WHEN** un docente envía valores válidos para contacto, pertenencia institucional, descripción o interés de mentoría
- **THEN** el sistema actualiza su inscripción y su perfil de mentor de manera consistente

#### Scenario: Docente deja de estar disponible
- **WHEN** un docente sin asignación vigente cambia su interés de mentoría a un valor distinto de afirmativo
- **THEN** el sistema guarda el cambio y cancela sus invitaciones de mentoría pendientes

#### Scenario: Intento de modificar un campo protegido
- **WHEN** un participante intenta cambiar nombre, email, DNI, vínculo, estado FTCA, declaración histórica de equipo, consentimientos o cualquier campo no permitido
- **THEN** el sistema rechaza la solicitud completa y conserva la inscripción anterior

#### Scenario: Interés de mentoría desactivado con asignación vigente
- **WHEN** un docente que ya acompaña un equipo intenta indicar que no desea ser mentor
- **THEN** el sistema rechaza el cambio e indica que la asignación debe resolverse administrativamente antes

### Requirement: Actualización consistente y trazable
El sistema MUST aplicar cada edición de perfil de forma atómica, detectar versiones obsoletas y auditar qué participante cambió qué campos sin registrar secretos ni contenido documental.

#### Scenario: Actualización válida
- **WHEN** el participante guarda sobre la versión vigente de su perfil
- **THEN** la inscripción y sus proyecciones se actualizan juntas y se registra una intervención de autogestión

#### Scenario: Edición concurrente
- **WHEN** la inscripción cambia después de que el participante la consultó y antes de guardar
- **THEN** el sistema devuelve un conflicto y exige recargar los datos sin sobrescribir el cambio más reciente

#### Scenario: Fallo de una proyección
- **WHEN** no puede actualizarse alguno de los registros derivados del perfil
- **THEN** ninguna parte de la edición queda persistida

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
