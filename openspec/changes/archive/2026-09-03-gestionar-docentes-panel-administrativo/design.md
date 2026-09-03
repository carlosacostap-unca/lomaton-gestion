## Context

La base ya representa la relación docente-inscripción en `mentor_profiles`, permite varias filas de `team_mentorships` para un mismo mentor y conserva un índice único por equipo. Las operaciones administrativas existentes asignan o reemplazan el mentor de un equipo, retiran una mentoría individual, auditan el cambio y exigen motivo cuando la formación está cerrada. La interfaz actual sólo expone esas operaciones desde el detalle del equipo. Véanse `proposal.md` y las especificaciones del cambio para el comportamiento esperado.

## Goals / Non-Goals

**Goals:**

- Construir una proyección administrativa mínima y centrada en docentes que reúna disponibilidad, carga actual y equipos seleccionables.
- Reutilizar las operaciones de mentoría existentes para mantener validaciones, auditoría e idempotencia en un único lugar.
- Presentar asignaciones múltiples sin confundir la ausencia de límite por docente con la regla de un mentor por equipo.
- Mantener la sección utilizable con muchos docentes y en pantallas estrechas.

**Non-Goals:**

- Cambiar el esquema de PocketBase o migrar mentorías existentes.
- Permitir que estudiantes o docentes administren asignaciones.
- Editar los datos personales o académicos del docente desde esta sección.
- Reintroducir invitaciones de mentoría o imponer un cupo máximo de equipos por docente.
- Eliminar la gestión de mentor desde el detalle de cada equipo.

## Decisions

### 1. Proyección dedicada basada en inscripciones docentes

Se agregará una consulta administrativa dedicada que parta de `registrations` con vínculo `teacher` y componga, en memoria del servidor, `mentor_profiles`, `team_mentorships` y `teams`. Partir de la inscripción evita omitir docentes cuyo perfil técnico aún falte o esté inactivo. La respuesta contendrá sólo identificadores operativos, nombre, afiliación académica, disponibilidad, equipos asignados y un catálogo resumido de equipos con su mentor actual.

Alternativa considerada: reutilizar el padrón privado de inscripciones. Se descarta porque incluye DNI, teléfono y campos ajenos a la vista, y obligaría al cliente a resolver relaciones sensibles.

### 2. Elegibilidad explícita, sin ocultar docentes

El directorio mostrará todas las inscripciones docentes. Un campo derivado distinguirá como asignable únicamente el perfil de mentor activo con interés `yes`; los demás permanecerán visibles con una causa comprensible y controles de asignación deshabilitados. Así el listado conserva valor administrativo sin debilitar la regla aplicada por el servidor.

Alternativa considerada: listar sólo docentes elegibles. Se descarta porque impediría explicar por qué una persona registrada no puede ser asignada.

### 3. Reutilización de comandos por equipo

La interfaz docente invocará las operaciones existentes de asignación/reemplazo por `teamId` y retiro por `mentorshipId`. No se creará un comando de “asignación masiva”: cada confirmación será atómica, auditable e independiente. Tras cada éxito se recargará la proyección docente completa para reflejar cambios simultáneos y mantener coherencia con la sección Equipos.

Alternativa considerada: enviar una lista completa de equipos del docente y reemplazarla en bloque. Se descarta porque aumenta el riesgo de borrar asignaciones concurrentes o registrar auditorías ambiguas.

### 4. Reemplazo visible antes de confirmar

El catálogo de equipos incluirá el mentor vigente. Si el administrador selecciona un equipo ocupado por otro docente, la interfaz mostrará un paso de confirmación que nombre al mentor actual y al nuevo. Seleccionar un equipo ya asignado al mismo docente no habilitará una nueva operación. El backend seguirá siendo la autoridad final ante carreras concurrentes.

Alternativa considerada: reemplazar inmediatamente al elegir el equipo. Se descarta por el impacto operativo de retirar una mentoría existente sin una confirmación inequívoca.

### 5. Lista compacta con acciones por docente

`/admin/docentes` cargará automáticamente la proyección y mostrará resúmenes compactos filtrables. Cada entrada enseñará disponibilidad y equipos, y abrirá sus controles de asignación sólo cuando el administrador decida gestionarla. En móvil los campos se apilarán y los controles ocuparán el ancho disponible, sin tablas horizontales.

Alternativa considerada: renderizar formularios completos para todos los docentes. Se descarta porque recrearía el exceso de scroll que motivó la reorganización administrativa.

### 6. Navegación de siete destinos

“Docentes” se agregará junto a “Estudiantes”; no reemplazará ninguna sección. El menú conservará URL estable y estado activo por `pathname`. Las pruebas fijarán siete destinos para detectar cambios accidentales.

## Risks / Trade-offs

- [La proyección compone varias colecciones y puede crecer con el evento] → Consultar cada colección una sola vez, usar mapas por identificador y devolver campos mínimos; medir antes de introducir paginación innecesaria.
- [Un equipo puede cambiar de mentor entre la carga y la confirmación] → Tratar la vista previa como informativa, mantener la validación del servidor y recargar el directorio después de éxito o conflicto.
- [Una inscripción docente puede no tener `mentor_profile`] → Mostrarla como no disponible y no inventar un identificador asignable.
- [Dos secciones podrán gestionar la misma mentoría] → Reutilizar los mismos comandos y emitir el evento de cambio de datos para que ambas vistas converjan al recargarse.
- [La séptima opción puede comprimir demasiado el menú móvil] → Conservar la grilla adaptable, nombres cortos y una prueba E2E de ausencia de desplazamiento horizontal.

## Migration Plan

1. Desplegar la proyección y la ruta administrativa de lectura.
2. Publicar la nueva sección y enlazarla desde el menú.
3. Verificar asignación adicional, reemplazo y retiro sobre mentorías existentes sin modificar datos previamente almacenados.
4. Ante una regresión, retirar el enlace y la nueva ruta; las operaciones y mentorías existentes permanecen compatibles porque no hay migración de esquema.
