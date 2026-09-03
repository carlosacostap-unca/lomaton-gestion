## 1. Preparar la proyección administrativa

- [x] 1.1 Leer las guías instaladas de Next.js 16 pertinentes a rutas, redirecciones y parámetros antes de modificar la navegación, y verificar que las decisiones usen las APIs vigentes del proyecto.
- [x] 1.2 Implementar una proyección tipada que componga inscripciones estudiantiles, candidatos, certificados, membresías, equipos e invitaciones pendientes, y verificar con pruebas unitarias la exclusión de docentes, la facultad derivada, los cuatro estados documentales y las relaciones faltantes.
- [x] 1.3 Exponer la proyección mediante una consulta `/api/lomaton/admin/students` protegida por el control administrativo existente, y verificar con pruebas de ruta que un administrador reciba sólo los campos permitidos y que usuarios no administrativos no reciban datos.

## 2. Construir la sección Estudiantes

- [x] 2.1 Crear el listado administrativo que cargue automáticamente los estudiantes y muestre nombre, facultad, presentación y validación del certificado, equipo e invitaciones pendientes, y verificar mediante pruebas de componente los estados con equipo, invitaciones, sin certificado y vacío.
- [x] 2.2 Conservar desde cada fila la edición administrativa de la inscripción estudiantil y refrescar la proyección después de guardar, verificando que perfiles docentes no sean seleccionables ni aparezcan en el listado.
- [x] 2.3 Incorporar estados accesibles de carga, error y reintento, además de una presentación utilizable en pantallas estrechas, y verificar foco, etiquetas y ausencia de desplazamiento horizontal en el recorrido responsivo.

## 3. Actualizar navegación y compatibilidad

- [x] 3.1 Sustituir en el menú la opción Personas por Estudiantes con destino `/admin/estudiantes`, y verificar que permanezcan exactamente seis destinos y que Estudiantes se marque como activo.
- [x] 3.2 Crear la ruta Estudiantes y convertir `/admin/personas` en una redirección a la nueva URL, verificando acceso directo, recarga y compatibilidad con la ruta anterior.
- [x] 3.3 Actualizar las pruebas de integración y E2E del espacio administrativo para cubrir la carga del directorio, privacidad, navegación de escritorio y móvil y ausencia de Personas en el menú.

## 4. Validación integral

- [x] 4.1 Ejecutar `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` y `npm run build`, y corregir cualquier regresión hasta que las verificaciones aplicables finalicen correctamente.
- [x] 4.2 Validar el cambio con OpenSpec en modo estricto y revisar manualmente que el listado no exponga DNI, teléfono, contenido del certificado ni credenciales de almacenamiento.
