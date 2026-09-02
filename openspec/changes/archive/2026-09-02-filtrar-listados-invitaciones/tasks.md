## 1. Lógica compartida de búsqueda

- [x] 1.1 Implementar una utilidad pura que normalice mayúsculas, tildes y espacios y filtre por subcadena sobre campos autorizados, y verificar con pruebas unitarias consultas vacías, coincidencias y ausencia de resultados.
- [x] 1.2 Definir las proyecciones buscables de estudiantes y docentes sin incorporar campos privados, y verificar mediante pruebas que sólo intervienen nombre/correo para estudiantes y nombre/departamento/descripción para docentes.

## 2. Selectores del responsable

- [x] 2.1 Incorporar búsqueda controlada al selector de estudiantes disponibles, limpiar selecciones que dejan de coincidir y deshabilitar envíos inválidos, y verificar filtrado por nombre/correo y estado vacío con pruebas de componente.
- [x] 2.2 Incorporar búsqueda controlada al selector de docentes elegibles con el mismo comportamiento, y verificar filtrado por nombre/departamento/descripción y preservación del identificador invitado mediante pruebas de componente.
- [x] 2.3 Añadir mensajes de cantidad o ausencia de resultados y estilos responsive compatibles con teclado, y verificar etiquetas, regiones de estado, foco y recorrido móvil en pruebas de interfaz.

## 3. Verificación integral

- [x] 3.1 Ejecutar la suite unitaria, de componentes y Playwright, y verificar que crear equipos e invitar estudiantes o docentes continúa funcionando sin regresiones.
- [x] 3.2 Ejecutar lint, typecheck, build de producción y validación estricta de OpenSpec, y verificar que todas finalizan sin errores accionables.
