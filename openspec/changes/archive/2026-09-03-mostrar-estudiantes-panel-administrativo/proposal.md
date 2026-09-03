## Why

La sección administrativa “Personas” mezcla perfiles de estudiantes y docentes, pero no permite conocer de un vistazo la situación operativa de cada estudiante. Los administradores necesitan una vista específica que reúna pertenencia académica, certificado y estado de integración a equipos sin recorrer varias secciones.

## What Changes

- Reemplazar el destino visible “Personas” por “Estudiantes” en la navegación administrativa y establecer `/admin/estudiantes` como su URL estable.
- Redirigir la antigua ruta `/admin/personas` a la nueva sección para conservar enlaces previos sin volver a mostrar “Personas” en el menú.
- Mostrar únicamente estudiantes registrados, con nombre, facultad o unidad académica, presentación del certificado, estado de validación documental, equipo aceptado e invitaciones pendientes.
- Diferenciar claramente certificado no presentado, pendiente, aprobado y rechazado, sin exponer el PDF ni metadatos internos en el listado.
- Mostrar el nombre del equipo al que pertenece el estudiante o, si todavía no pertenece a uno, los equipos que mantienen invitaciones pendientes para esa persona.
- Conservar desde cada estudiante la capacidad administrativa existente de editar su inscripción, sin incorporar docentes al nuevo listado.
- Proteger la consulta agregada para que solamente una cuenta administradora pueda acceder a estos datos.

## Capabilities

### New Capabilities

- `admin-student-directory`: listado administrativo consolidado y privado de estudiantes con información académica, certificado, membresía e invitaciones pendientes.

### Modified Capabilities

- `admin-workspace`: sustituir la sección y ruta visible Personas por Estudiantes, manteniendo navegación directa, adaptable y compatible con la URL anterior.

## Impact

- Navegación y rutas bajo `app/admin`.
- Nueva proyección de dominio y consulta administrativa sobre inscripciones, candidatos, certificados, membresías, equipos e invitaciones.
- Interfaz de listado de estudiantes y reutilización controlada de la edición administrativa existente.
- Pruebas unitarias, de autorización, integración y navegación E2E del panel administrativo.
