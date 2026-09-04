## Why

Los equipos pueden formarse y ser consultados por la organización, pero actualmente no existe un dato estructurado que indique sobre cuál de los cinco desafíos trabajará cada uno. La organización necesita que el propio equipo registre una única elección y que esa decisión quede visible en el panel administrativo, sin depender de comunicaciones externas ni texto libre.

## What Changes

- Incorporar un catálogo cerrado y versionado con los cinco desafíos oficiales del hackatón.
- Permitir que cualquier estudiante con membresía vigente seleccione o cambie el único desafío de su equipo desde el portal de autogestión.
- Rechazar valores ajenos al catálogo y operaciones de usuarios que no pertenezcan al equipo.
- Persistir la selección en el equipo para que todos sus integrantes observen el mismo estado.
- Mostrar el desafío elegido en el listado y detalle administrativo de equipos, diferenciando claramente los equipos que todavía no realizaron la selección.
- Mantener la lectura administrativa dentro de los controles de acceso existentes y no exponer datos adicionales del equipo.

## Capabilities

### New Capabilities

- `team-challenge-selection`: selección única, validada y compartida del desafío oficial por parte de integrantes vigentes del equipo.

### Modified Capabilities

- `hackathon-reporting`: incorporar el desafío seleccionado o su ausencia en las vistas administrativas de equipos.

## Impact

- Esquema y migraciones de la colección `teams` en PocketBase.
- Comandos de dominio, hooks y ruta autenticada para actualizar la selección.
- Proyección del portal de participantes y componentes de autogestión del equipo.
- Proyecciones, listado y detalle de equipos del panel administrativo.
- Pruebas unitarias, de autorización, integración y E2E del flujo participante-administrador.
