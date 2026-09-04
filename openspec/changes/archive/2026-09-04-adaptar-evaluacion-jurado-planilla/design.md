## Context

Véase `proposal.md` para la motivación. La evaluación vigente materializa una fila por ciclo, jurado y equipo, almacena cinco puntajes escala 0–10 en columnas dedicadas y publica sumas consolidadas. El ciclo ya posee `criteriaVersion`, pero las respuestas, cálculos y pantallas asumen una única definición. La nueva planilla requiere trece puntajes 1–5, observaciones por aspecto, promedios por criterio y un total sobre 100; además, los grupos de tres aspectos generan fracciones periódicas que no deben depender de coma flotante.

PocketBase sólo permite acceso directo a las colecciones de evaluación mediante la cuenta técnica. Las transiciones de apertura, finalización, reapertura y publicación usan API Batch y deben conservar atomicidad, control de versión, privacidad e índices existentes. No hay staging y el esquema productivo se aplica mediante el MCP después de un respaldo explícito.

## Goals / Non-Goals

**Goals:**

- Representar la matriz oficial como una definición versionada e inmutable por ciclo.
- Persistir borradores parciales con trece puntajes y observaciones sin perder compatibilidad con la versión 0–10.
- Calcular promedios, ponderados y consolidados con aritmética racional entera y redondeo reproducible.
- Mantener DTO y pantallas separados por rol para que observaciones y evaluaciones individuales no lleguen a participantes.
- Desplegar el esquema de forma aditiva, verificable y reversible antes de abrir un ciclo con la nueva versión.

**Non-Goals:**

- Incorporar un catálogo o campo libre de desafíos para los equipos.
- Permitir que administradores o jurados editen aspectos, escalas o pesos desde la interfaz.
- Convertir puntajes históricos 0–10 a la nueva matriz ni comparar rankings entre versiones.
- Exportar nuevamente una planilla Excel o ejecutar las macros del archivo recibido.

## Decisions

### 1. Mantener un catálogo de rúbricas versionadas y guardar una instantánea en cada ciclo

El contrato compartido definirá `lomaton-2026-v1` para lectura histórica y una nueva versión `lomaton-2026-planilla-v2` con los cinco criterios, trece aspectos, escala 1–5, etiquetas y pesos. Al abrir un ciclo nuevo, el servidor persistirá tanto el identificador como una instantánea JSON validada de la rúbrica.

La instantánea evita que una edición futura del catálogo cambie la interpretación de un ciclo abierto o publicado. El catálogo de código sigue siendo necesario para validar versiones conocidas y renderizar registros v1 que no poseen instantánea. Se descarta depender únicamente del código porque debilita la trazabilidad histórica, y se descarta una rúbrica administrable porque la organización entregó una matriz fija.

### 2. Ampliar las colecciones existentes sin eliminar columnas v1

`evaluation_cycles` añadirá `criteriaSnapshot`. `jury_evaluations` conservará `scoreInnovation`, `scoreImpact`, `scoreViability`, `scorePresentation`, `scoreTeamwork`, `completedCriteria` y `totalCentipoints` para v1, y añadirá:

- `aspectScores`: JSON con claves permitidas y enteros 1–5;
- `aspectObservations`: JSON con textos opcionales normalizados y limitados;
- `totalNumerator` y `totalDenominator`: representación racional exacta del total v2.

`evaluation_results` conservará las sumas v1 y añadirá `criterionAspectScoreSums`, `totalNumeratorSum` y `totalDenominator` para los resultados v2. La versión se obtiene a través del ciclo relacionado; ningún registro puede mezclar campos activos de ambas versiones.

Se eligen mapas JSON porque los trece aspectos son una unidad versionada y PocketBase no necesita filtrarlos individualmente. Las reglas cerradas y la validación servidora compensan que JSON no tenga restricciones por clave en el esquema. Trece columnas de puntaje más trece columnas de observación harían más rígida una futura versión y duplicarían el código de migración.

### 3. Representar los cálculos como fracciones enteras y redondear sólo en los bordes

Para cada criterio v2:

- promedio exacto = `sumaAspectos / cantidadAspectos` en escala 1–5;
- ponderado exacto = `sumaAspectos × peso / (cantidadAspectos × 5)` sobre 100.

El total individual será la suma de esas fracciones reducida a `totalNumerator / totalDenominator`. El servidor derivará valores con dos decimales mediante redondeo decimal simétrico a partir de enteros; nunca aceptará promedios ni totales enviados por el navegador.

Al publicar, `criterionAspectScoreSums` permitirá obtener el promedio consolidado exacto de cada criterio dividiendo por `cantidadAspectos × cantidadJurados`. El total consolidado dividirá `totalNumeratorSum` por `totalDenominator × cantidadJurados`. Todos los integrantes de un ciclo comparten rúbrica y denominador, verificado antes de publicar.

Se descarta almacenar decimales calculados como fuente de verdad porque la planilla contiene tercios y podría producir diferencias entre navegador, servidor y base de datos.

### 4. Despachar lectura, escritura y presentación según `criteriaVersion`

El módulo de dominio resolverá un adaptador de evaluación por versión:

- v1 conserva los cinco campos, validación 0–10, total 0–10 y DTO histórico;
- v2 valida claves permitidas, puntajes 1–5, observaciones y total racional sobre 100.

Las rutas mantendrán los mismos recursos, pero sus DTO incluirán `criteriaVersion`, `scale`, la definición agrupada y una unión discriminada para datos v1 o v2. Guardar y finalizar rechazarán un cuerpo cuya versión no coincida con el ciclo. Un ciclo v1 que ya estuviera abierto podrá completarse o cancelarse con su flujo original; todos los ciclos nuevos se abrirán como v2.

Esto evita una migración destructiva o una ventana en la que un ciclo abierto quede inutilizable. Se descarta convertir automáticamente v1 a v2 porque no existe correspondencia entre cinco puntajes y trece aspectos.

### 5. Tratar observaciones como datos privados por aspecto

Cada aspecto admite una observación opcional, recortada, con longitud máxima definida por el servidor y sin contenido obligatorio. Los DTO de jurado propio y administración pueden incluirlas; los DTO de progreso resumido y resultado del equipo las omiten por construcción. La auditoría registra la transición y las claves completadas, pero no duplica el texto de las observaciones.

Se descarta una única observación general porque la planilla presenta una celda de observación por aspecto. También se evita incluir observaciones en resultados consolidados porque no existe una regla de publicación para ellas.

### 6. Reproducir la semántica de la planilla con una interfaz adaptable

El formulario del jurado mostrará encabezado de equipo/proyecto y jurado, seguido de cinco grupos. Cada grupo expone peso, máximo, aspectos, selector entero 1–5, observación, promedio y ponderado calculados. El total permanece visible mientras se edita. En pantallas estrechas, los grupos se presentan como tarjetas verticales en lugar de forzar la tabla de ocho columnas.

La administración verá el mismo detalle en modo de revisión, además del progreso y las acciones existentes. El estudiante verá cinco promedios consolidados con una leyenda de escala 1–5 y el total sobre 100. Las pantallas v1 conservarán etiquetas y unidades históricas.

### 7. Mantener las transiciones multirregistro en lotes atómicos

Apertura seguirá creando ciclo, matriz y auditoría en un único API Batch, ahora con la instantánea v2. Finalización actualizará evaluación, contador del ciclo y auditoría en otro lote. Publicación revalidará versión, cobertura y completitud, generará todos los agregados v2 y cambiará el ciclo a `published` en una sola operación.

Los índices de ciclo abierto, par ciclo-jurado-equipo y resultado ciclo-equipo se conservan como defensa frente a carreras. Las pruebas productivas aisladas provocarán un fallo intermedio controlado y verificarán ausencia de filas y estados parciales.

## Risks / Trade-offs

- **[JSON con forma inválida por escritura externa]** → Mantener reglas PocketBase cerradas, validar claves/tipos/rangos en toda lectura y escritura y probar payloads con claves desconocidas.
- **[Diferencias de redondeo frente a Excel]** → Usar fracciones enteras, documentar la regla de redondeo a dos decimales y contrastar casos con tercios contra la fórmula de la planilla.
- **[Ciclo v1 abierto durante el despliegue]** → Conservar adaptador, formulario y comandos v1; ejecutar una precomprobación productiva antes de aplicar esquema y desplegar.
- **[Resultados de distintas versiones confundidos]** → Incluir versión y unidad en DTO y UI, y prohibir cualquier agregación entre ciclos.
- **[Observaciones con datos sensibles o demasiado extensos]** → Limitar longitud, mantenerlas sólo en proyecciones autorizadas y excluir su contenido de auditorías y respuestas de participantes.
- **[Formulario extenso en móvil]** → Navegación por grupos, resumen fijo de progreso, controles etiquetados y ausencia de tablas horizontales.

## Migration Plan

1. Verificar en producción si existe un ciclo abierto, crear y descargar un respaldo nativo de PocketBase y registrar los conteos de las colecciones afectadas.
2. Aplicar una migración aditiva y reversible que incorpore los campos v2 sin eliminar ni reinterpretar campos v1; actualizar también el esquema idempotente del MCP.
3. Validar campos, reglas, límites, API Batch e índices en producción antes del despliegue de Next.js.
4. Desplegar la aplicación compatible con ambas versiones y ejecutar pruebas de lectura histórica, borrador/finalización v2, publicación transaccional y privacidad.
5. Confirmar con una cuenta de jurado que los trece aspectos, observaciones, promedios, ponderados y total coincidan con la planilla antes de abrir el ciclo real.
6. Para rollback de aplicación, volver a la versión anterior mientras no se haya abierto un ciclo v2. Si ya existen datos v2, conservar el esquema y restaurar la aplicación compatible; retirar campos sólo después de exportar o eliminar explícitamente esos datos.
