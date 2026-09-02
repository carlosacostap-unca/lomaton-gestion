## 1. Esquema y transición de datos

- [x] 1.1 Leer las guías locales de Next.js pertinentes para Route Handlers y componentes cliente antes de editar, y verificar que las APIs elegidas correspondan a la versión instalada.
- [x] 1.2 Actualizar la definición canónica de `team_mentorships` para conservar la unicidad por equipo y eliminar la unicidad por docente; verificar en la prueba de esquema que el índice `idx_team_mentorships_mentor` ya no se genera.
- [x] 1.3 Agregar una migración reversible que elimine el índice por docente y cancele con fecha de resolución todas las invitaciones de mentoría pendientes; verificar la migración sobre datos de prueba y comprobar que conserva asignaciones e invitaciones históricas.

## 2. Dominio y API

- [x] 2.1 Implementar la asignación o reemplazo administrativo de un mentor activo e interesado, con lote atómico, versión de datos, motivo posterior al cierre y auditoría de antes/después; verificar creación, reemplazo, docente no elegible y motivo obligatorio mediante pruebas unitarias.
- [x] 2.2 Permitir que un docente conserve asignaciones simultáneas a varios equipos mientras cada equipo mantiene una sola; verificar con pruebas de dominio y esquema que la segunda asignación del docente funciona y una segunda fila para el mismo equipo falla.
- [x] 2.3 Cambiar el estado estudiantil a una asignación de solo lectura y el tablero docente a una lista de todos sus equipos con integrantes operativos; verificar mediante pruebas que no se devuelven certificados ni datos privados.
- [x] 2.4 Incorporar la ruta administrativa `/api/lomaton/admin/teams/:teamId/mentor` y retirar las rutas públicas de búsqueda, creación, retiro y resolución de invitaciones docentes; verificar que sólo un administrador puede asignar o reemplazar y que los endpoints anteriores no modifican datos.
- [x] 2.5 Mantener `mentor_invitations` únicamente en reportes históricos y adaptar las pruebas de snapshot y exportación para verificar que el flujo operativo ya no crea invitaciones nuevas.

## 3. Interfaces por rol

- [x] 3.1 Convertir la tarjeta de mentoría estudiantil en una vista de solo lectura que muestre al docente asignado o que la organización aún debe asignarlo; verificar que no existan buscador, selector ni botones para invitar o retirar docentes.
- [x] 3.2 Adaptar el tablero docente para listar todos los equipos asignados y retirar la sección de invitaciones y sus acciones; verificar múltiples equipos, estado vacío y privacidad mediante pruebas de componente.
- [x] 3.3 Añadir en la gestión administrativa de cada equipo un selector de docentes activos e interesados y acciones para asignar, reemplazar o retirar; verificar que un docente ya usado continúe disponible y que las operaciones muestren resultado accesible.

## 4. Verificación integral

- [x] 4.1 Actualizar las pruebas de aceptación de mentorías para cubrir asignación administrativa, un docente en varios equipos, un mentor máximo por equipo y cancelación de pendientes; verificar que la suite de aceptación configurada finalice correctamente.
- [x] 4.2 Ejecutar `npm test` y comprobar que pasan todas las pruebas unitarias e integradas, incluidas las de esquema, rutas, dominio, reportes y componentes.
- [x] 4.3 Ejecutar `npm run lint`, `npm run typecheck` y `npm run build`, y corregir cualquier regresión relacionada con el cambio.
- [x] 4.4 Ejecutar `npx openspec validate asignar-mentores-desde-administracion --strict` y confirmar la coherencia entre propuesta, especificaciones, diseño y tareas.
