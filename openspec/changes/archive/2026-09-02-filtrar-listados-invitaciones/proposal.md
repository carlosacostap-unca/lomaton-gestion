## Why

Cuando un equipo tiene muchas personas elegibles, recorrer un selector completo dificulta encontrar al estudiante o docente correcto y aumenta el riesgo de invitar a otra persona. Los responsables necesitan acotar rápidamente ambos listados sin perder las reglas actuales de disponibilidad, privacidad y exclusividad.

## What Changes

- Añadir un campo de búsqueda al selector de estudiantes disponibles para invitar.
- Añadir un campo de búsqueda al selector de docentes elegibles para mentoría.
- Filtrar inmediatamente los datos ya autorizados, ignorando mayúsculas, minúsculas, tildes y espacios exteriores.
- Permitir buscar estudiantes por nombre o correo y docentes por nombre, departamento o descripción institucional.
- Mostrar estados accesibles cuando la búsqueda no tenga coincidencias y conservar una selección válida solamente mientras continúe visible.
- Mantener sin cambios las reglas de elegibilidad, cupo, propiedad del equipo, privacidad y creación de invitaciones.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `team-formation`: incorporar búsqueda y filtrado accesible sobre los listados de estudiantes y docentes ya elegibles antes de enviar una invitación.

## Impact

- Componentes de selección del panel del responsable en `app/candidate/candidate-dashboard.tsx` y `app/portal/team-mentor-card.tsx`.
- Estilos y pruebas de interfaz del portal.
- No requiere cambios de esquema, migraciones, dependencias ni ampliación de datos expuestos por las APIs.
