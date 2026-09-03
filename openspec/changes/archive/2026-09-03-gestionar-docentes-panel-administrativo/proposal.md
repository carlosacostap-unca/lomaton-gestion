## Why

La asignación de mentorías sólo se gestiona actualmente desde el detalle de cada equipo, lo que dificulta conocer la carga de cada docente y asignar una misma persona a varios equipos. Los administradores necesitan una vista centrada en docentes que reúna esa información y permita operar las mentorías sin perder las reglas de integridad existentes.

## What Changes

- Añadir “Docentes” como séptima sección del menú administrativo, con URL estable `/admin/docentes`.
- Mostrar un directorio exclusivo de inscripciones docentes con nombre, unidad académica o departamento, disponibilidad para mentorías y equipos actualmente asignados.
- Permitir buscar y filtrar docentes y distinguir claramente quiénes están habilitados para nuevas asignaciones.
- Permitir asignar desde cada docente uno o más equipos, sin imponer un límite de equipos por mentor y sin alterar sus asignaciones anteriores.
- Conservar la regla de un solo mentor por equipo; si el equipo ya posee otro mentor, la interfaz deberá informar el reemplazo antes de confirmarlo.
- Permitir retirar una asignación individual desde la vista docente sin afectar los demás equipos acompañados por la misma persona.
- Proteger la consulta y las operaciones con el control administrativo vigente, sin exponer datos personales innecesarios.

## Capabilities

### New Capabilities

- `admin-teacher-directory`: Directorio administrativo de docentes, visualización de sus equipos y gestión de asignaciones múltiples de mentoría.

### Modified Capabilities

- `admin-workspace`: Incorporar Docentes como una nueva sección enlazable y adaptable del menú administrativo.

## Impact

- Nueva ruta de interfaz `/admin/docentes` y actualización del menú administrativo de seis a siete destinos.
- Nueva proyección administrativa que compone inscripciones docentes, perfiles de mentor, equipos y mentorías sin incluir DNI, teléfono ni otros campos ajenos al directorio.
- Nuevas consultas administrativas y reutilización de las operaciones auditadas de asignación, reemplazo y retiro de mentorías existentes.
- Pruebas unitarias, de componentes, rutas y E2E para listado, disponibilidad, asignación múltiple, reemplazo, retiro, privacidad y comportamiento responsivo.
- No requiere cambios de esquema: la base ya admite varias mentorías para un docente y una única mentoría por equipo.
