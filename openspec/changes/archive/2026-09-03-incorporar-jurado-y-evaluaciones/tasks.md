## 1. Preparar plataforma y persistencia

- [x] 1.1 Leer las guías instaladas de Next.js 16 pertinentes a rutas, componentes cliente, navegación, formularios y Route Handlers antes de modificar la aplicación, y verificar que las decisiones usen las APIs vigentes del proyecto.
- [x] 1.2 Crear una migración PocketBase reversible para jurados, ciclos, evaluaciones, resultados y la relación opcional de usuario, con reglas cerradas e índices únicos por correo, ciclo abierto, ciclo-jurado-equipo y ciclo-equipo; verificar estructura, índices y rollback mediante pruebas de esquema.
- [x] 1.3 Implementar la ejecución transaccional servidor para apertura, cancelación y publicación, y verificar con pruebas de integración que un fallo intermedio no deje matrices, resultados ni estados parciales.

## 2. Incorporar identidad y administración de jurados

- [x] 2.1 Extender el bootstrap y la proyección de sesión con el jurado activo, conservando permisos simultáneos existentes y revocando vínculos desactivados; verificar acceso de jurado, cuenta no registrada, múltiples áreas y renovación mediante pruebas unitarias y de ruta.
- [x] 2.2 Añadir autorización servidora específica para Jurado y DTO mínimos por área, y verificar que participantes, jurados y solicitudes anónimas no puedan acceder a rutas ajenas ni recibir evaluaciones o datos privados.
- [x] 2.3 Implementar comandos administrativos para listar, buscar, crear, editar, activar y desactivar jurados con correo normalizado único y bloqueo durante un ciclo abierto; verificar éxitos, duplicados, validaciones, auditoría y conservación ante fallos.
- [x] 2.4 Añadir /admin/jurados, el destino Jurados al menú y una interfaz compacta con alta y edición bajo demanda; verificar estados vacío/carga/error, búsqueda, activación, edición, accesibilidad por teclado y protección no administrativa.

## 3. Construir el dominio de evaluación

- [x] 3.1 Implementar los cinco criterios oficiales y el cálculo entero en centésimos, rechazando decimales, faltantes al finalizar y valores fuera de 0–10; verificar pesos, extremos y ejemplos 7,95 y 8,00 con pruebas unitarias.
- [x] 3.2 Implementar apertura y cancelación administrativas sobre una instantánea de todos los jurados activos y equipos no disueltos, creando exactamente cada par una vez y congelando la nómina; verificar nóminas vacías, segundo ciclo, altas posteriores, cancelación motivada y carreras.
- [x] 3.3 Implementar las consultas privadas del jurado y los comandos de guardar borrador y finalizar con versión esperada; verificar progreso completo, guardado parcial, finalización atómica, bloqueo posterior, conflicto concurrente y denegación sobre evaluaciones ajenas.
- [x] 3.4 Implementar el seguimiento administrativo por jurado, equipo y estado, el detalle de puntajes y la reapertura motivada previa a publicación; verificar conteos de faltantes, actualización de avance, auditoría y rechazo de reapertura publicada.
- [x] 3.5 Implementar la publicación solamente cuando toda la matriz esté finalizada, calculando y fijando promedios por criterio y total para cada equipo; verificar bloqueo anticipado, uso de todos los jurados, redondeo determinista, idempotencia rechazada y atomicidad ante carreras.
- [x] 3.6 Implementar la consulta del resultado publicado para integrantes del equipo, y verificar que antes de publicar no revele avance, después entregue solo sus promedios y deniegue resultados de otros equipos, borradores, jurados y puntajes individuales.

## 4. Crear las experiencias de evaluación

- [x] 4.1 Añadir /jurado con listado resumido de todos los equipos, progreso y formulario de un equipo seleccionado, incluyendo valores enteros, cálculo visible, guardado de borrador y confirmación de finalización; verificar recorridos pendiente/borrador/finalizado, reintento y foco.
- [x] 4.2 Añadir /admin/evaluacion y el destino Evaluación al menú con resumen del ciclo, filtros, matriz de avance, detalle, apertura, cancelación, reapertura y publicación confirmadas; verificar que la publicación permanezca deshabilitada hasta completar todas las evaluaciones.
- [x] 4.3 Integrar en el portal del estudiante la tarjeta de resultados de su equipo con estado no publicado y los cinco promedios más el total después de publicar; verificar que no se rendericen identidades ni evaluaciones individuales.
- [x] 4.4 Adaptar las nuevas superficies a pantalla estrecha sin tablas horizontales y con etiquetas, estados anunciados, foco y controles operables por teclado; verificar accesibilidad de componentes y ausencia de desplazamiento horizontal.

## 5. Verificar el circuito completo

- [x] 5.1 Ejecutar las pruebas de esquema e integración contra PocketBase para comprobar índices, permisos, transacciones, cobertura completa y persistencia publicada, y corregir cualquier regresión.
- [x] 5.2 Añadir pruebas E2E con al menos dos jurados y dos equipos que cubran alta, apertura, borradores, intento de publicación incompleta, finalización total, reapertura, nueva finalización, publicación y visibilidad privada de cada equipo.
- [x] 5.3 Ejecutar npm run lint, npm run typecheck, npm test, npm run test:e2e y npm run build, y corregir cualquier regresión hasta que todas las verificaciones aplicables finalicen correctamente.
- [x] 5.4 Validar el cambio con OpenSpec en modo estricto y revisar manualmente que todos los jurados deban evaluar todos los equipos, los puntajes sean enteros 0–10, los pesos sumen 100 %, la publicación exija completitud y ninguna respuesta exponga evaluaciones ajenas.
