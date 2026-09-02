## Why

La selección de mentores debe quedar bajo coordinación de la organización, en lugar de depender de invitaciones enviadas por estudiantes y aceptadas por docentes. Además, limitar cada docente a un solo equipo impide distribuir la mentoría según la disponibilidad real de la organización.

## What Changes

- **BREAKING**: eliminar la posibilidad de que estudiantes busquen o inviten docentes y de que docentes acepten o rechacen invitaciones de mentoría.
- Permitir que solamente un administrador asigne, reemplace o retire el mentor de cada equipo, con auditoría y motivo obligatorio cuando la formación esté cerrada.
- Mantener como máximo un mentor por equipo, pero permitir que un mismo docente sea mentor de cualquier cantidad de equipos, sin límite.
- Mostrar a estudiantes el mentor asignado en modo de solo lectura y a cada docente todos los equipos que acompaña.
- Cancelar las invitaciones de mentoría que estén pendientes al desplegar el nuevo modelo, conservándolas como historial y evitando que puedan resolverse después del cambio.
- Mantener la mentoría separada de la membresía estudiantil y sin impacto en el cupo ni en el cálculo FTCA.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `team-formation`: reemplaza el flujo de invitaciones de mentoría por asignaciones administrativas y elimina la exclusividad de un equipo por docente.
- `hackathon-administration`: incorpora la asignación, reemplazo y retiro directo de mentores como intervenciones administrativas auditadas.

## Impact

- Portal estudiantil y tablero docente.
- Gestión administrativa de equipos y rutas de intervención.
- Comandos de dominio, DTO de mentoría, reportes y auditoría.
- Esquema e índices de `team_mentorships`; se elimina la unicidad por docente y se conserva la unicidad por equipo.
- Migración de invitaciones de mentoría pendientes y compatibilidad histórica de reportes.
- Pruebas unitarias, de integración y de aceptación del flujo de mentorías.
