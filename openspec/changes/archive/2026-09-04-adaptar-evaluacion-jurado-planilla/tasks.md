## 1. Preparar la rúbrica y la persistencia

- [x] 1.1 Revisar la documentación de la versión instalada de Next.js pertinente a formularios, componentes cliente, rutas y validación antes de modificar la aplicación; verificar que el diseño de implementación use únicamente APIs vigentes en `node_modules/next/dist/docs/`.
- [x] 1.2 Incorporar al contrato compartido la versión `lomaton-2026-planilla-v2` con los cinco criterios, los trece aspectos textuales exactos, la escala entera de 1 a 5 y sus etiquetas; verificar mediante pruebas unitarias el orden, el texto, la cantidad de aspectos y que los pesos sumen 100%.
- [x] 1.3 Implementar funciones de cálculo exacto para promedios por criterio y total ponderado sobre 100, redondeando sólo la presentación o el resultado consolidado; verificar con casos límite, puntajes mixtos y el ejemplo de todos los aspectos en 1 y en 5.
- [x] 1.4 Crear una migración reversible de PocketBase y actualizar el esquema idempotente para guardar la versión y la instantánea de la rúbrica, puntajes y observaciones por aspecto y acumuladores racionales, conservando los campos históricos de la rúbrica v1; verificar aplicación, segunda aplicación sin cambios y rollback en la prueba de esquema.

## 2. Adaptar el dominio y las API

- [x] 2.1 Implementar la resolución de rúbrica por versión y DTO discriminados para v1 y v2, sin convertir evaluaciones históricas; verificar con pruebas que una evaluación existente 0–10 continúa leyéndose y que una nueva usa exclusivamente la matriz v2.
- [x] 2.2 Adaptar la apertura de un ciclo para congelar atómicamente la versión v2 y su instantánea exacta, evitando mezclar rúbricas dentro del mismo ciclo; verificar los casos de apertura, reapertura rechazada y consistencia entre equipos y jurados.
- [x] 2.3 Adaptar el guardado de borradores v2 para aceptar puntajes parciales enteros de 1 a 5 y observaciones opcionales por aspecto con longitud limitada, manteniendo el control de concurrencia; verificar claves desconocidas, decimales, valores fuera de rango, borradores parciales y conflictos de versión.
- [x] 2.4 Adaptar la finalización v2 para exigir los trece puntajes válidos y calcular los cinco promedios y el total ponderado, sin exigir observaciones; verificar que falte cualquier aspecto impide finalizar y que un envío completo queda inmutable para el jurado.
- [x] 2.5 Adaptar la consulta administrativa y la reapertura para mostrar y restaurar correctamente puntajes y observaciones por aspecto en v2, manteniendo la lectura v1; verificar autorización, auditoría sin contenido privado y transición de finalizada a borrador.
- [x] 2.6 Adaptar la consolidación y publicación para promediar exactamente los resultados de todos los jurados, bloquear la publicación anticipada y persistir el total sobre 100 sin error acumulado de punto flotante; verificar varios jurados, empates, decimales periódicos, jurado faltante y versiones incompatibles.
- [x] 2.7 Adaptar el resultado propio del equipo para exponer en v2 sólo los cinco promedios por criterio y el total sobre 100, y conservar el formato histórico v1; verificar que nunca incluya puntajes por aspecto, observaciones ni identidades de jurados.
- [x] 2.8 Actualizar los esquemas de entrada y salida de las rutas para discriminar v1/v2 y rechazar cargas ambiguas o inválidas; verificar contratos HTTP, autenticación y autorización con pruebas de rutas para jurado, administración y estudiante.

## 3. Adaptar las interfaces

- [x] 3.1 Rediseñar el formulario del jurado con cinco bloques en el orden de la planilla, los trece aspectos textuales exactos, controles enteros 1–5, referencias de escala, observación opcional por aspecto, promedios y total; verificar por pruebas de componente que guardar borrador y finalizar respeten todos los estados y validaciones.
- [x] 3.2 Mantener visible la ponderación de cada criterio y el máximo total de 100 sin inventar un dato de desafío cuando la plataforma no disponga de él; verificar que los textos y cálculos coincidan con la planilla en escritorio y móvil.
- [x] 3.3 Adaptar la vista administrativa para inspeccionar evaluaciones v2 por criterio y aspecto, incluidas sus observaciones, y seguir mostrando evaluaciones v1 con su escala original; verificar ambos formatos con datos de prueba y controles de reapertura/publicación.
- [x] 3.4 Adaptar la vista publicada del equipo para presentar los cinco promedios v2 en escala 1–5 y el total ponderado sobre 100, manteniendo el resultado v1 cuando corresponda; verificar estados no publicado/publicado y ausencia de datos privados en el DOM y las respuestas.
- [x] 3.5 Ajustar estilos, navegación por teclado, etiquetas y mensajes de error para que la matriz sea legible y operable sin desplazamiento horizontal; verificar foco, lectores de pantalla básicos y anchos móviles representativos.

## 4. Verificar, documentar y desplegar

- [x] 4.1 Actualizar la documentación funcional, de arquitectura, esquema y despliegue con la matriz oficial exacta, la convivencia v1/v2, las fórmulas y la privacidad de observaciones; verificar que el campo `desafío` quede explícitamente fuera de alcance hasta definir su fuente y reglas de carga.
- [x] 4.2 Agregar pruebas integrales con al menos dos jurados y dos equipos que cubran borrador parcial, observaciones, bloqueo por aspecto faltante, finalización, reapertura, nueva finalización, consolidación y publicación; verificar además una fixture histórica v1 sin regresiones.
- [x] 4.3 Ejecutar la validación de tipos, lint, pruebas unitarias, pruebas de esquema, pruebas de integración/E2E y build de producción; corregir hasta que todos los comandos finalicen correctamente y registrar cualquier advertencia residual.
- [x] 4.4 Validar el cambio con OpenSpec en modo estricto y revisar manualmente que los trece textos visibles, su agrupación 3/3/3/3/1, la escala 1–5 y los pesos 25/25/20/15/15 coincidan literalmente con la planilla adjunta.
- [x] 4.5 Antes de habilitar la rúbrica v2 en producción, realizar respaldo, comprobar que no haya un ciclo abierto incompatible, aplicar la migración autorizada, validar el esquema y ejecutar una evaluación controlada completa; verificar el resultado sobre 100 y limpiar únicamente los datos de prueba identificados.
