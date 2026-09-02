## MODIFIED Requirements

### Requirement: Separación de datos privados y operativos
El sistema SHALL conservar la respuesta de inscripción con acceso administrativo restringido, SHALL permitir a cada participante consultar solamente una proyección segura de su propia inscripción y SHALL exponer a otros participantes únicamente los datos mínimos necesarios para equipos y mentorías.

#### Scenario: Datos privados importados
- **WHEN** se confirma una inscripción válida
- **THEN** DNI, teléfono, datos académicos, consentimientos y respuestas originales quedan disponibles solamente para administradores autorizados, procesos técnicos y, mediante la proyección de perfil propio, para la persona titular

#### Scenario: Titular consulta su inscripción
- **WHEN** un participante autenticado consulta su propio perfil
- **THEN** el sistema devuelve sus datos permitidos sin incluir la respuesta original ni metadatos técnicos de importación

#### Scenario: Consulta entre candidatos
- **WHEN** un candidato busca compañeros o consulta integrantes de un equipo
- **THEN** el sistema no expone DNI, teléfono, consentimientos ni respuestas privadas del formulario

#### Scenario: Consulta de mentoría
- **WHEN** un equipo consulta docentes disponibles o un docente consulta el equipo que acompaña
- **THEN** el sistema expone solamente identidad operativa, pertenencia institucional y datos necesarios para la mentoría, sin revelar inscripciones privadas, certificados ni consentimientos

#### Scenario: Consentimiento no respondido
- **WHEN** una rama del formulario no solicita explícitamente una autorización
- **THEN** el sistema conserva ese consentimiento como no informado y no lo infiere a partir de otras respuestas

## ADDED Requirements

### Requirement: Autogestión preserva identidad y elegibilidad
El sistema SHALL permitir que el titular actualice sólo los campos declarados como autoeditables y MUST reservar a la administración los cambios de identidad, rol, elegibilidad, declaraciones históricas y consentimiento.

#### Scenario: Actualización autoeditable
- **WHEN** el titular guarda datos válidos de contacto, académicos o descriptivos habilitados para su rol
- **THEN** el sistema actualiza la inscripción y sus proyecciones aplicables sin alterar email, DNI, vínculo ni estado FTCA

#### Scenario: Cambio que requiere administración
- **WHEN** el titular necesita corregir un dato protegido
- **THEN** el sistema lo muestra como no editable e indica que debe solicitar asistencia administrativa

#### Scenario: Reimportación posterior a una autogestión
- **WHEN** una importación posterior coincide con una inscripción que posee campos autoeditables actualizados por su titular
- **THEN** el sistema preserva esos valores autoeditados, actualiza los campos administrados por la importación e informa la diferencia en la vista previa

#### Scenario: Corrección administrativa posterior
- **WHEN** un administrador corrige explícitamente una inscripción después de una autogestión
- **THEN** la corrección administrativa prevalece, queda auditada y pasa a ser la nueva versión visible para el titular

