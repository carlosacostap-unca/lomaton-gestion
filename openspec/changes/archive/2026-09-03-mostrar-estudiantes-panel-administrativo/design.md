## Context

La navegación administrativa ya separa cada herramienta en una ruta propia, pero `/admin/personas` monta un editor mixto de inscripciones que sólo obtiene datos cuando se ejecuta una búsqueda. La nueva sección debe cargar automáticamente una proyección estudiantil que combina información de inscripciones, candidatos, certificados, membresías, equipos e invitaciones. Véanse `proposal.md` y las especificaciones delta para el comportamiento esperado.

## Goals / Non-Goals

**Goals:**

- Entregar una única proyección administrativa, acotada y tipada para el directorio de estudiantes.
- Resolver en el servidor los estados derivados de certificado, equipo e invitaciones para mantener la interfaz simple y consistente.
- Conservar la edición administrativa de estudiantes sin seguir mezclando docentes en el listado principal.
- Mantener autorización administrativa y evitar que identificadores o credenciales de archivos privados lleguen a la vista.

**Non-Goals:**

- Cambiar las reglas de aceptación de invitaciones, pertenencia exclusiva o revisión de certificados.
- Crear una nueva sección de docentes o rediseñar su administración.
- Modificar el esquema de PocketBase, importar datos nuevos o corregir automáticamente relaciones históricas inconsistentes.
- Incorporar acciones de aprobación documental dentro del directorio; esa operación continúa en Certificados.

## Decisions

### Proyección agregada específica en el servidor

Se añadirá una proyección de dominio para el directorio, obtenida mediante consultas paralelas a inscripciones, candidatos, certificados, membresías, equipos e invitaciones pendientes. La proyección partirá de inscripciones cuyo vínculo sea estudiantil, asociará cuando exista su candidato y devolverá únicamente nombre, facultad, identificadores operativos mínimos, estado documental, equipo e invitaciones pendientes.

Esto evita que el navegador descargue instantáneas administrativas generales y reproduce un patrón ya usado por los resúmenes de equipos. Como alternativa se consideró combinar varias consultas en el cliente, pero aumentaría la exposición de datos y produciría estados intermedios inconsistentes.

### Estado documental normalizado en cuatro valores

La respuesta distinguirá `not_presented`, `pending`, `approved` y `rejected`. La interfaz derivará de ese valor las dos respuestas solicitadas: presentación y validación. Un estado histórico vacío se normalizará como pendiente, de acuerdo con el ciclo documental existente.

Se descartó enviar simplemente dos booleanos porque perderían la diferencia operativa entre pendiente y rechazado.

### Facultad derivada con precedencia explícita

La proyección usará la unidad académica informada cuando exista; para estudiantes FTCA sin otra unidad informada usará `FTyCA`; y, en ausencia de datos, devolverá `No informada`. La resolución queda centralizada en el servidor para que pruebas y futuras vistas compartan el mismo criterio.

### Membresías e invitaciones como relaciones identificables

El equipo aceptado se resolverá desde la membresía y se devolverá con identificador y nombre. Las invitaciones se limitarán al estado pendiente y también incluirán el nombre del equipo. La interfaz no inferirá membresías a partir del formulario original ni de invitaciones aceptadas históricas.

### Ruta nueva y compatibilidad controlada

El menú apuntará a `/admin/estudiantes`. La ruta `/admin/personas` se convertirá en una redirección de servidor hacia la nueva ubicación para conservar marcadores existentes. No habrá un enlace visible a Personas.

### Edición preservada desde la selección

La lista ofrecerá una acción para editar el estudiante seleccionado reutilizando el contrato administrativo existente. Tras guardar, la vista volverá a consultar la proyección para reflejar posibles cambios de nombre o facultad. Los perfiles docentes quedan fuera del conjunto seleccionable.

## Risks / Trade-offs

- [La proyección consulta varias colecciones] → ejecutar lecturas en paralelo, devolver campos mínimos y cubrir la composición mediante pruebas unitarias de dominio.
- [Una relación histórica puede apuntar a un equipo o candidato inexistente] → mostrar un estado seguro y comprensible sin omitir al estudiante ni inventar pertenencia.
- [Un estudiante podría conservar una invitación pendiente pese a tener membresía por datos antiguos] → devolver el estado real de ambas relaciones y no alterar datos durante una consulta de lectura.
- [La tabla puede resultar ancha en dispositivos pequeños] → reutilizar el contenedor desplazable o una presentación responsiva, con encabezados y estados textuales accesibles.
- [La edición conserva campos privados que no deben aparecer en la lista] → cargar o mantener esos datos únicamente dentro del editor administrativo seleccionado, nunca en la proyección resumida.

## Migration Plan

1. Incorporar y probar la proyección y la ruta administrativa sin cambiar datos persistidos.
2. Publicar la nueva página y sustituir el destino del menú.
3. Convertir `/admin/personas` en redirección y verificar acceso directo, recarga y navegación móvil.
4. Desplegar sin migración de base de datos; ante una regresión, restaurar el destino y componente anteriores mientras el endpoint nuevo puede retirarse sin afectar datos.
