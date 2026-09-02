## Context

Actualmente el panel del responsable carga todos los candidatos activos, excluye localmente a quienes ya poseen membresía y los muestra en un selector. Los docentes elegibles llegan mediante una API con una proyección segura y también se muestran en un selector completo. Véase `proposal.md` para la motivación y el delta de `team-formation` para el comportamiento esperado.

## Goals / Non-Goals

**Goals:**

- Compartir una normalización de búsqueda determinista entre estudiantes y docentes.
- Filtrar sin nuevas solicitudes de red y sin modificar las proyecciones de datos existentes.
- Mantener la selección y el envío consistentes cuando cambia la consulta.
- Comunicar cantidad de resultados y ausencia de coincidencias mediante texto accesible.

**Non-Goals:**

- Agregar búsqueda administrativa, paginación o autocompletado remoto.
- Modificar reglas de elegibilidad, cupo, exclusividad o autorización.
- Exponer nuevos campos de candidatos, inscripciones o perfiles docentes.
- Cambiar el esquema de PocketBase o las rutas de invitación.

## Decisions

### Filtrar en el cliente sobre el conjunto ya elegible

Cada panel conservará la carga actual y derivará sus opciones visibles a partir del listado autorizado. Esto evita introducir consultas remotas por cada pulsación, mantiene intactas las fronteras de privacidad y ofrece respuesta inmediata.

Se descartó agregar parámetros de búsqueda a las APIs porque los conjuntos ya se descargan para construir los selectores y el cambio no requiere paginación. También se descartó buscar directamente en colecciones privadas de inscripciones.

### Usar una normalización pura y reutilizable

Una función compartida convertirá texto a minúsculas, separará y eliminará marcas diacríticas, normalizará espacios y recortará extremos. La coincidencia será por subcadena normalizada: nombre y correo para estudiantes; nombre, departamento y descripción institucional para docentes.

Se descartó comparar texto sin normalizar porque obliga al usuario a reproducir mayúsculas o tildes y produce resultados inconsistentes entre ambos listados.

### Mantener controles explícitos de búsqueda y selección

Cada selector tendrá un campo de búsqueda asociado por etiqueta. Las opciones se derivarán del texto vigente; si la selección deja de estar visible, se limpiará. Sin coincidencias se mostrará un mensaje con estado accesible y el envío permanecerá deshabilitado.

Se conserva el selector nativo para mantener navegación por teclado, foco y comportamiento móvil conocidos. No se incorpora un componente de combobox complejo ni una dependencia externa.

### Verificar la lógica y los dos recorridos de interfaz

Las pruebas unitarias cubrirán normalización, campos buscables, consulta vacía y ausencia de coincidencias. Las pruebas de componentes comprobarán filtrado, limpieza de selección, estado accesible y que la invitación conserva el identificador correcto.

## Risks / Trade-offs

- [Listados grandes pueden aumentar el trabajo en cada pulsación] → derivar resultados con memoización; la operación es lineal sobre datos que la aplicación ya carga.
- [Una selección oculta podría enviarse por error] → limpiar explícitamente el identificador seleccionado cuando deja de pertenecer al resultado filtrado.
- [Normalizar tildes puede hacer coincidir más opciones de las esperadas] → mostrar nombre y contexto autorizado completos en cada opción para que el responsable confirme antes de invitar.

## Migration Plan

No hay migración de datos ni cambios de API. Desplegar la actualización de interfaz después de pruebas unitarias, de componentes, Playwright y compilación. El rollback consiste en revertir los componentes y el helper de filtrado; PocketBase no se modifica.
