## Why

La evaluación implementada usa un puntaje único de 0 a 10 por criterio, mientras que la planilla oficial recibida solicita puntajes enteros de 1 a 5 sobre trece aspectos concretos y calcula un resultado ponderado sobre 100. La plataforma debe reproducir esa matriz y sus cálculos para que el circuito digital coincida con el instrumento que utilizará el jurado.

## What Changes

- **BREAKING** para los ciclos nuevos: reemplazar los cinco puntajes enteros de 0 a 10 por trece puntajes enteros de 1 a 5, distribuidos exactamente como aparecen en la planilla: 3 aspectos de Innovación y originalidad, 3 de Impacto potencial, 3 de Viabilidad técnica, 3 de Presentación y comunicación y 1 de Trabajo en equipo.
- Mantener las ponderaciones oficiales 25 %, 25 %, 20 %, 15 % y 15 %, calcular el promedio de los aspectos de cada criterio y expresar el puntaje ponderado final de cada jurado sobre 100 con redondeo determinista a dos decimales.
- Incorporar observaciones opcionales asociadas a cada aspecto, privadas para jurados y administradores y excluidas de los resultados que ve el equipo.
- Adaptar borradores, finalización, reapertura, seguimiento administrativo y publicación para exigir los trece aspectos completos y presentar promedios por criterio y total sobre 100.
- Versionar la matriz como una nueva definición de criterios, conservar legibles e inmutables los ciclos históricos abiertos con la versión anterior y evitar mezclar registros de ambas versiones.
- Actualizar el portal del jurado para reflejar la estructura visual de la planilla, mostrando equipo/proyecto, jurado, grupos de criterio, peso, aspectos, puntaje 1–5, promedio, ponderado, máximo y observaciones.
- Actualizar el resultado publicado del estudiante para mostrar los cinco promedios consolidados en escala 1–5 y el puntaje final consolidado sobre 100, sin revelar observaciones ni evaluaciones individuales.
- No incorporar en este cambio un campo de desafío para los equipos, porque la plataforma no posee todavía una fuente ni una regla de carga para ese dato.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `jury-evaluation`: cambia la matriz de puntuación, la escala, las observaciones, los cálculos, la finalización, el seguimiento y la publicación de evaluaciones.
- `participant-self-service`: cambia la escala y la presentación del resultado consolidado publicado para el equipo.

## Impact

- Esquema y migración PocketBase para persistir trece puntajes, observaciones, versión de definición y resultados agregados sin destruir datos históricos.
- Contratos y rutas servidoras de evaluación, validación de borradores/finalización, cálculo ponderado y publicación transaccional.
- Portal del jurado, sección administrativa de evaluación y tarjeta de resultados del estudiante.
- Pruebas unitarias, de esquema, autorización, integración productiva y E2E; documentación del modelo de evaluación y del despliegue de PocketBase.
