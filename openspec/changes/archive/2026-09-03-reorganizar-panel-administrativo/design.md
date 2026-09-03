## Context

La motivación está en [proposal.md](./proposal.md). Actualmente `app/admin/page.tsx` monta consecutivamente resumen, plazo, equipos, importación, certificados, padrón, exportaciones y auditoría. Cada componente inicia sus propias consultas al montarse. `AdminTeamManager` obtiene una instantánea amplia y renderiza formularios completos para todos los equipos, mientras que `AdminCertificateReviewQueue` expande un panel por certificado y `AdminCertificatePanel` sólo ofrece descargar el archivo autenticado.

Las rutas de certificados ya entregan el PDF mediante un proxy administrativo con autorización y `Cache-Control: private, no-store`. Los comandos de equipos ya concentran reglas, lotes, auditoría y control posterior al cierre; la reorganización debe reutilizarlos sin duplicar lógica ni relajar permisos.

## Goals / Non-Goals

**Goals:**

- Separar la administración en rutas que monten únicamente la herramienta elegida y compartan una navegación consistente.
- Ofrecer listas compactas con un solo detalle activo para certificados y equipos.
- Visualizar PDFs autenticados sin crear URLs públicas ni forzar una descarga local.
- Conservar estados de búsqueda, filtro y selección útiles mediante rutas o parámetros de URL.
- Mantener las operaciones, restricciones de rol, auditoría interna y protección de concurrencia existentes.

**Non-Goals:**

- Eliminar colecciones, registros de auditoría o endpoints de exportación.
- Rediseñar las reglas de revisión documental, la formación de equipos o el cálculo FTCA.
- Introducir un nuevo visor PDF externo, persistir miniaturas o almacenar copias adicionales.
- Exponer Reportes o Auditoría como destinos del nuevo menú administrativo.

## Decisions

### 1. Usar rutas administrativas reales dentro de un shell compartido

El espacio se dividirá en `/admin`, `/admin/equipos`, `/admin/certificados`, `/admin/personas`, `/admin/importacion` y `/admin/configuracion`. Un shell compartido concentrará encabezado, control de acceso, cierre de sesión y menú; cada segmento montará únicamente su contenido. `/admin` será el Resumen.

En escritorio el menú será lateral y persistente. En pantallas estrechas usará una presentación compacta accesible que conserve los mismos enlaces, el indicador activo y el orden. Las rutas permiten recarga, marcadores y navegación atrás/adelante sin inventar sincronización adicional de estado.

**Alternativa considerada:** conservar una única página y alternar componentes con estado local. Se descarta porque pierde el destino al recargar, dificulta enlaces directos y vuelve más probable que herramientas ocultas permanezcan montadas o consultando datos.

Reportes y Auditoría se retirarán del árbol visible del shell y de la página principal. Sus componentes, endpoints y datos no se borrarán en este cambio, para preservar compatibilidad y trazabilidad interna.

### 2. Convertir certificados en una vista maestra-detalle con un único documento activo

La sección Certificados conservará filtros y paginación, pero separará la lista resumida del panel de detalle. En escritorio usará dos columnas; en móvil el detalle se presentará debajo de la lista o como vista enfocada sin ancho lateral obligatorio. Estado, página y candidato seleccionado se reflejarán en parámetros de URL cuando resulte útil para restaurar contexto.

El PDF se recuperará con `fetch` autenticado desde el proxy existente, se convertirá en una URL de objeto temporal y se mostrará mediante un elemento nativo de documento con título accesible y alternativa. Al cambiar de candidato, cerrar el detalle o desmontar la sección se revocará la URL. La descarga seguirá usando el mismo contenido y nombre seguro como acción separada.

**Alternativa considerada:** insertar directamente la URL protegida en un `iframe`. Se descarta porque el visor no podría adjuntar de forma fiable el encabezado Bearer requerido. También se descarta una biblioteca PDF adicional: el visor nativo cubre la necesidad sin aumentar dependencias ni superficie de seguridad.

### 3. Separar resumen y detalle operativo de equipos

La sección Equipos mostrará filas o tarjetas compactas con nombre, estado, integrantes, FTCA, mentor y advertencias. Búsqueda y filtros vivirán en la URL o en estado restaurable. Seleccionar “Ver y gestionar” abrirá `/admin/equipos/[teamId]`, que cargará el responsable, miembros, invitaciones, mentor, candidatos disponibles y acciones de un solo equipo.

Se incorporarán proyecciones administrativas específicas: una consulta de colección para resúmenes y otra para detalle. La interfaz dejará de depender de la instantánea global de reportes para editar equipos. Después de una operación, se actualizará el detalle y la proyección resumida correspondiente, conservando los comandos atómicos y mensajes de conflicto actuales.

**Alternativa considerada:** seguir descargando la instantánea completa y ocultar con CSS los equipos no elegidos. Se descarta porque mantiene el exceso de datos, formularios y coste de renderizado que origina el problema.

### 4. Aislar carga, errores y navegación sin relajar autorización

Cada página de sección será responsable de sus consultas, estados vacíos y reintentos. Un error dentro de una herramienta no bloqueará el menú. El shell verificará la identidad administrativa para la experiencia visual y cada Route Handler seguirá aplicando autorización administrativa independientemente, incluyendo accesos directos por URL.

La opción activa usará semántica de navegación y estado perceptible; al cambiar de listado a detalle el foco se moverá al título principal o al mensaje de resultado. Las acciones destructivas conservarán confirmación y los formularios posteriores al cierre seguirán exigiendo motivo.

**Alternativa considerada:** confiar únicamente en la protección del layout cliente. Se descarta porque una ruta o API puede invocarse sin atravesar la interfaz.

## Risks / Trade-offs

- [El visor nativo de PDF varía entre navegadores móviles] → ofrecer alternativa clara para reintentar, abrir o descargar, y probar al menos Safari móvil y navegadores de escritorio.
- [Las URLs de objeto retienen memoria] → revocarlas determinísticamente al reemplazar, cerrar o desmontar el documento.
- [La navegación por rutas puede perder filtros] → codificar filtro, página y selección relevante en parámetros de URL y probar retroceso/recarga.
- [El detalle cambia mientras otro administrador opera] → conservar versiones, conflictos recuperables y recarga de la entidad vigente.
- [La lista y el detalle quedan temporalmente desalineados] → refrescar ambas proyecciones después de cada comando exitoso y mostrar estados de actualización.
- [Retirar accesos visibles a exportaciones o auditoría sorprende a usuarios existentes] → limitar el cambio a la navegación y documentar que endpoints y datos subyacentes siguen conservados.

## Migration Plan

1. Incorporar el shell y las rutas de sección manteniendo inicialmente disponibles los componentes actuales.
2. Migrar cada herramienta a su ruta y verificar que sólo la sección activa consulta datos.
3. Sustituir la cola expandible por lista y detalle con visor PDF temporal.
4. Introducir las proyecciones de resumen y detalle de equipos y reemplazar el administrador monolítico.
5. Retirar de `/admin` el montaje anterior y los accesos visibles a Reportes y Auditoría.
6. Validar rutas directas, permisos, navegación móvil, teclado, PDF, operaciones de equipos y regresión integral antes de desplegar.

Para revertir, se puede restaurar la composición monolítica anterior sin migración de datos. Las rutas o proyecciones nuevas pueden quedar inactivas; ningún documento, equipo, auditoría o exportación debe eliminarse durante el rollback.
