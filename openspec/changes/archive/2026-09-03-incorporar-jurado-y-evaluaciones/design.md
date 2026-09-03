## Context

La aplicación usa Next.js como interfaz y capa de API, PocketBase como persistencia y Google como único proveedor de identidad. El arranque de sesión proyecta hoy los permisos de estudiante, docente y administrador sobre el registro autenticado; las operaciones sensibles pasan por rutas servidoras con cliente de servicio y las intervenciones administrativas se auditan.

Este cambio atraviesa autenticación, modelo de datos, API, panel administrativo, un nuevo portal de jurado y el portal de estudiantes. La evaluación completa exige además consistencia entre una nómina congelada, muchas escrituras concurrentes y una publicación irreversible. Véanse proposal.md y las especificaciones delta para el comportamiento normativo.

## Goals / Non-Goals

**Goals:**

- Mantener una única fuente de verdad para jurados, evaluaciones, avance y resultados publicados.
- Garantizar por restricciones de datos y operaciones atómicas una evaluación por cada par jurado-equipo del proceso.
- Realizar cálculos deterministas sin errores de coma flotante ni confiar en valores enviados por el navegador.
- Conservar compatibilidad con las identidades que ya poseen permisos de participante o administrador.
- Evitar que datos de otros jurados o equipos atraviesen las respuestas autorizadas.

**Non-Goals:**

- Configurar criterios o ponderaciones desde la interfaz en esta primera versión.
- Crear rankings, desempates, premios, comentarios cualitativos o exportaciones.
- Excluir equipos distintos para cada jurado: todos evalúan la misma instantánea completa.
- Automatizar conflictos de interés; la organización deberá evitar registrar como jurado a una persona cuya participación comprometa la evaluación.
- Corregir resultados después de publicados. Una corrección posterior requerirá un cambio futuro con reglas explícitas.

## Decisions

### 1. Representar el rol Jurado con una entidad y una relación de usuario

Se añadirá una colección jurors con nombre, correo, correo normalizado, estado activo y fechas, protegida para uso exclusivo del servicio. users incorporará una relación opcional juror, del mismo modo que hoy enlaza candidato e inscripción. El bootstrap consultará el jurado activo por correo y devolverá una proyección de áreas permitidas que preserve los campos actuales y añada el acceso de jurado.

Esto permite que una misma identidad conserve, por ejemplo, permisos administrativos y de jurado sin convertir un rol en otro. Las interfaces ofrecerán accesos separados y las rutas volverán a validar el rol en cada solicitud. Se descarta modelar Jurado como otra clase de inscripción porque no comparte datos académicos ni autogestión con estudiantes y docentes; también se descarta un booleano sin relación porque impediría identificar al autor estable de cada evaluación.

### 2. Persistir un proceso versionado y una matriz congelada

Se crearán:

- evaluation_cycles: estado open, cancelled o published, versión de criterios, conteos, actores y fechas de apertura/cancelación/publicación.
- jury_evaluations: ciclo, jurado, equipo, nombres congelados, estado pending, draft o finalized, cinco puntajes opcionales, total ponderado entero, versión y fecha de finalización.
- evaluation_results: resultado inmutable por ciclo y equipo, con sumas consolidadas, cantidad de jurados, promedios y fecha de publicación.

Al abrir, una operación transaccional captura todos los jurados activos y equipos no disueltos, crea el producto cartesiano y registra los conteos esperados. Índices únicos impedirán más de un ciclo abierto, duplicados por ciclo-jurado-equipo y más de un resultado por ciclo-equipo. Los nombres congelados preservan la interpretación histórica aunque luego cambien las entidades de origen.

Se elige una matriz materializada en vez de calcular asignaciones dinámicamente porque permite medir faltantes, conservar la misma cobertura durante todo el proceso y evitar que un alta posterior modifique silenciosamente la condición de publicación.

### 3. Usar aritmética entera y cálculo exclusivamente servidor

Cada criterio se validará como entero entre 0 y 10. El total se almacenará en centésimos de punto mediante:

totalCentipoints = scoreInnovation×25 + scoreImpact×25 + scoreViability×20 + scorePresentation×15 + scoreTeamwork×15

El rango resultante es 0–1000 y se presenta dividido por 100. En la publicación se sumarán los centésimos de todos los jurados y se conservarán también el divisor y las sumas por criterio; las respuestas redondearán de forma determinista a dos decimales. El servidor ignorará cualquier total calculado enviado por el cliente.

Se descarta almacenar directamente valores decimales porque introduce diferencias de redondeo entre navegador, servidor y base de datos.

### 4. Separar comandos, proyecciones y permisos

Un módulo de dominio de evaluación concentrará validación, transiciones, cálculo, control de versión y auditoría. Las rutas expondrán proyecciones distintas:

- Administración: CRUD de jurados, apertura/cancelación/publicación, matriz de avance, detalle y reapertura.
- Jurado: lista de su trabajo y lectura/guardado/finalización de su propia evaluación.
- Participante: resultado consolidado publicado de su propio equipo.

Las colecciones no tendrán lectura o escritura directa para usuarios normales; las rutas usarán el cliente de servicio después de autenticar y autorizar. Las respuestas se construirán mediante DTO explícitos, no devolviendo registros PocketBase completos.

Se descarta reutilizar una única respuesta con filtrado en el cliente porque filtraría demasiado tarde y aumentaría el riesgo de exponer evaluaciones ajenas.

### 5. Hacer explícitas y atómicas las transiciones

Abrir, cancelar, finalizar, reabrir y publicar exigirán estado y versión esperados. La publicación volverá a contar dentro de la misma operación que todas las filas estén finalizadas, calculará todos los resultados, los persistirá y cambiará el ciclo a published. Una reapertura previa a publicación cambia solamente la evaluación seleccionada a draft, incrementa su versión y vuelve a bloquear la completitud. Una cancelación conserva las filas como historial ineditable y libera la posibilidad de abrir un proceso nuevo.

Se usará una transacción PocketBase o un hook transaccional para los comandos que abarcan varias colecciones; un lote sin garantía transaccional no es suficiente para apertura o publicación. Los índices únicos serán la última defensa frente a carreras.

### 6. Diseñar tres superficies compactas

- /admin/jurados: directorio con búsqueda, alta y edición bajo demanda.
- /admin/evaluacion: estado del ciclo, progreso resumido, filtros por jurado/equipo/estado, detalle y acciones críticas confirmadas.
- /jurado: lista compacta de equipos y formulario de un único equipo seleccionado, con progreso, guardado de borrador y confirmación de finalización.

El portal de estudiantes añadirá una tarjeta de resultados que antes de publicar solo informa indisponibilidad y después muestra los cinco promedios y el total. Las pantallas usarán rutas enlazables, estados de carga/error aislados, controles etiquetados y diseño sin tablas horizontales en móvil.

## Risks / Trade-offs

- **[Crecimiento jurados × equipos]** → Validar límites operativos antes de abrir, crear la matriz dentro de una transacción eficiente e indexar ciclo, jurado, equipo y estado.
- **[Cambios de equipo después de abrir]** → Usar instantánea y nombres congelados; la interfaz administrativa advertirá que los cambios no ingresan al proceso vigente.
- **[Jurados con varios roles o conflicto de interés]** → Mantener permisos separados y mostrar la identidad claramente; documentar que la selección organizativa debe resolver conflictos en esta versión.
- **[Filtración de puntajes individuales]** → Usar proyecciones específicas por rol, pruebas negativas de autorización y reglas PocketBase cerradas.
- **[Publicación parcial por carrera]** → Revalidar completitud y persistir resultados/estado en una sola transacción con versión esperada.
- **[Corrección necesaria tras publicar]** → Mantener publicación inmutable; documentar la limitación y no ofrecer acciones que simulen una corrección insegura.

## Migration Plan

1. Añadir mediante una migración reversible las colecciones, índices, reglas cerradas y relación opcional de jurado en usuarios.
2. Desplegar primero el esquema y luego la aplicación compatible con usuarios sin relación de jurado.
3. Dar de alta jurados desde administración y validar el bootstrap con cuentas de prueba antes de abrir el proceso.
4. Abrir el primer ciclo solamente después de confirmar la nómina y los equipos; la operación no migra ni inventa evaluaciones históricas.
5. Para revertir antes de abrir un ciclo, retirar la aplicación y ejecutar la migración inversa. Si ya existen evaluaciones, exportar o respaldar las colecciones antes de revertir para no perder trazabilidad.
