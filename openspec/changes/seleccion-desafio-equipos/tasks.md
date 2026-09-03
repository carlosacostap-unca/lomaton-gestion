## 1. Preparar persistencia y contrato de dominio

- [x] 1.1 Leer las guías instaladas de Next.js 16 pertinentes a Route Handlers, validación y actualización de datos antes de modificar rutas o componentes, y confirmar que se usan las APIs vigentes del proyecto.
- [x] 1.2 Definir el catálogo compartido de cinco desafíos con identificadores estables, títulos canónicos, tipos y funciones de validación, y cubrir mediante pruebas el conjunto exacto, la resolución de títulos y el rechazo de valores desconocidos.
- [x] 1.3 Añadir a `teams` un campo opcional restringido al catálogo mediante esquema base, migración reversible y documentación; actualizar las verificaciones de esquema y probar equipos sin selección y cada valor permitido.

## 2. Implementar la selección autenticada

- [x] 2.1 Implementar el comando de dominio que resuelve al candidato autenticado, comprueba la membresía vigente, valida el desafío y actualiza atómicamente el único valor del equipo; verificar primera selección, reemplazo, idempotencia, no integrante, mentor y valor inválido.
- [x] 2.2 Exponer una ruta autenticada para actualizar el desafío del equipo con validación de entrada en el proxy de Next.js y en el servidor de PocketBase, y verificar respuestas de éxito, autenticación, autorización y errores sin modificación parcial.
- [x] 2.3 Incorporar el desafío actual y sus opciones oficiales a la proyección de autogestión del equipo sin ampliar los datos privados que recibe el navegador, y verificar equipos con selección, sin selección y con valor histórico desconocido.

## 3. Construir la experiencia del integrante

- [x] 3.1 Añadir al portal del equipo un selector accesible de opción única con los cinco títulos completos, estado inicial y acción explícita de guardado, visible para estudiantes con membresía vigente.
- [x] 3.2 Refrescar el estado con la respuesta confirmada por el servidor y ofrecer mensajes accesibles de carga, éxito y error; verificar cambio de selección, reintento, prevención de doble envío y presentación responsiva.

## 4. Mostrar la selección a administradores

- [x] 4.1 Ampliar las proyecciones administrativas de lista y detalle para devolver el desafío canónico o un estado sin selección, manteniendo el control administrativo y los campos mínimos.
- [x] 4.2 Mostrar el desafío en el listado y detalle de equipos con un rótulo legible para los cinco valores y “Sin seleccionar” cuando corresponda; verificar carga, filtros existentes, accesibilidad y pantallas estrechas.
- [x] 4.3 Actualizar la instantánea y exportaciones administrativas que representen equipos, cuando correspondan, para conservar una lectura coherente del dato sin duplicar la fuente canónica.

## 5. Validación integral

- [x] 5.1 Añadir pruebas E2E que cubran la selección por un integrante, el cambio reflejado para otro integrante y la visualización administrativa, además del rechazo a una cuenta ajena.
- [x] 5.2 Ejecutar `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` y `npm run build`, corregir regresiones y validar el cambio OpenSpec en modo estricto.
