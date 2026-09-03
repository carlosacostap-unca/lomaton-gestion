## Context

El equipo ya es la entidad compartida que concentra nombre, estado y proyecciones de membresía. El portal participante consulta el equipo vigente y el panel administrativo obtiene vistas resumidas y de detalle. La nueva elección debe ser un valor estructurado, común a todos los integrantes y limitado exactamente al listado oficial comunicado para el hackatón.

## Goals / Non-Goals

**Goals:**

- Mantener un único desafío vigente por equipo y una sola fuente canónica para los cinco valores permitidos.
- Autorizar la escritura a estudiantes con membresía vigente del equipo y asegurar la validación también en el servidor.
- Reflejar inmediatamente la elección en la autogestión del equipo y en las vistas administrativas.
- Representar de forma explícita el estado todavía no seleccionado para equipos existentes.

**Non-Goals:**

- Permitir desafíos personalizados, múltiples selecciones o un orden de preferencias.
- Asignar cupos, limitar cuántos equipos eligen cada desafío o resolver empates.
- Crear una pantalla administrativa para editar el catálogo o cambiar la elección en nombre del equipo.
- Convertir la elección en condición para formar, cerrar o evaluar un equipo.

## Decisions

### Identificador estable y título canónico

El código compartirá un catálogo con identificadores estables (`problematicas-imagenes`, `transito-planta`, `sistemas-medicion`, `consumo-materiales`, `edificios-sustentables`) y sus títulos oficiales. PocketBase almacenará solamente el identificador en un campo opcional del equipo; las respuestas de dominio incluirán identificador y título resuelto.

Esto evita duplicar textos largos en cada registro y permite corregir presentación sin migrar equipos. Se descarta almacenar texto libre porque impediría validar el conjunto cerrado y produciría variantes ortográficas.

### Actualización por cualquier integrante vigente

Cualquier estudiante autenticado con una membresía vigente en el equipo podrá seleccionar o reemplazar el desafío. La operación resolverá la identidad autenticada a candidato, comprobará la membresía y actualizará el único campo del equipo. Un docente mentor, una persona ajena al equipo o un usuario sin perfil estudiantil no podrá ejecutar la operación.

Se adopta esta política porque el pedido habla de que un miembro del equipo realice la carga y no define un rol de responsable permanente. Restringirla al creador añadiría una regla nueva y podría bloquear equipos cuya persona responsable ya no participe.

### Catálogo compartido con validación por capas

El catálogo se definirá en un módulo de dominio sin dependencia del navegador. La interfaz renderizará exclusivamente esas cinco opciones, el proxy de Next.js validará el cuerpo con el esquema vigente del proyecto y el comando del servidor volverá a validar el identificador antes de persistirlo. La colección aplicará además una restricción de selección compatible con PocketBase.

La validación del servidor es la autoridad; la lista del cliente solamente mejora la experiencia.

### Operación idempotente sobre el equipo

Una ruta autenticada dedicada recibirá el identificador elegido y ejecutará una actualización atómica del equipo. Volver a enviar el valor vigente será válido y devolverá el mismo estado. Cambiar a otro valor reemplazará la selección anterior; no se ofrecerá una acción para volver a dejarla vacía desde la interfaz.

Los equipos existentes conservarán valor vacío hasta que un integrante seleccione uno, por lo que la migración no requiere backfill.

### Lectura participante y administrativa desde proyecciones existentes

La proyección del equipo participante incorporará la selección y el catálogo necesario para el formulario. La lista y el detalle administrativos incorporarán el título resuelto o un estado `Sin seleccionar`. No se abrirá una consulta adicional por fila ni se enviarán datos privados nuevos.

Tras guardar, la interfaz participante reemplazará su estado con la respuesta confirmada por el servidor y mostrará un mensaje accesible de éxito o error.

## Risks / Trade-offs

- [Dos integrantes cambian la elección casi simultáneamente] -> la última actualización válida será la vigente y todas las vistas leerán el único valor persistido; no se crea historial funcional en esta entrega.
- [El catálogo del código y la restricción de PocketBase divergen] -> centralizar identificadores, añadir pruebas de esquema y verificar los cinco valores en la migración y el dominio.
- [Equipos históricos no tienen selección] -> conservar el campo opcional y mostrar un estado explícito, sin bloquear consultas ni evaluaciones existentes.
- [Un valor legado o corrupto aparece en datos] -> normalizarlo como no seleccionado en lecturas y rechazarlo en escrituras, sin mostrar texto no confiable.
- [Un miembro intenta actualizar después de perder la membresía] -> resolver la membresía en cada comando del servidor, no confiar en el estado previo del navegador.

## Migration Plan

1. Añadir el campo opcional y restringido al esquema `teams`, junto con su migración reversible y las verificaciones de esquema.
2. Desplegar catálogo, comando y ruta autenticada; los equipos existentes continúan válidos sin selección.
3. Publicar el selector participante y las vistas administrativas ampliadas.
4. Verificar que los cinco valores se guarden y lean correctamente y que un equipo sin selección se muestre sin errores.
5. Ante una regresión, ocultar los controles y la presentación antes de retirar el campo; la ausencia de backfill permite revertir sin transformar registros.
