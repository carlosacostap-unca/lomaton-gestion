# jury-evaluation Specification

## Purpose

Centralizar una evaluación completa, privada y verificable de todos los equipos por todos los jurados, aplicando criterios ponderados comunes y publicando resultados solamente cuando el proceso haya finalizado.

## Requirements

### Requirement: Registro administrativo de jurados
El sistema SHALL permitir que solamente los administradores creen, editen, activen o desactiven jurados mediante nombre completo y correo electrónico normalizado y único.

#### Scenario: Alta válida de jurado
- **WHEN** un administrador registra un nombre y un correo todavía no utilizado por otro jurado
- **THEN** el sistema crea un jurado activo habilitado para autenticarse y participar del próximo proceso de evaluación

#### Scenario: Correo de jurado duplicado
- **WHEN** un administrador intenta registrar o editar un jurado con el correo normalizado de otro jurado
- **THEN** el sistema rechaza la operación sin alterar ninguno de los registros

#### Scenario: Cambio de nómina durante una evaluación
- **WHEN** un administrador intenta activar, desactivar o eliminar un jurado incluido mientras existe un proceso de evaluación abierto
- **THEN** el sistema impide el cambio e informa que la nómina está congelada hasta publicar o cancelar ese proceso

### Requirement: Apertura con cobertura completa
El sistema SHALL permitir que un administrador abra un único proceso de evaluación tomando una instantánea de todos los jurados activos y todos los equipos existentes no disueltos, y MUST crear exactamente una evaluación para cada combinación jurado-equipo.

#### Scenario: Apertura válida
- **WHEN** existe al menos un jurado activo y al menos un equipo evaluable y el administrador abre la evaluación
- **THEN** el sistema congela ambas nóminas y genera la cobertura completa de jurados por equipos sin duplicados

#### Scenario: Apertura sin participantes suficientes
- **WHEN** no existe al menos un jurado activo o un equipo evaluable
- **THEN** el sistema rechaza la apertura e informa qué nómina está vacía

#### Scenario: Segundo proceso simultáneo
- **WHEN** un administrador intenta abrir otro proceso mientras existe uno abierto
- **THEN** el sistema rechaza la operación y conserva el proceso vigente

#### Scenario: Equipo incorporado después de la apertura
- **WHEN** se crea o modifica un equipo después de congelar la nómina
- **THEN** ese cambio no altera silenciosamente las evaluaciones requeridas por el proceso abierto

#### Scenario: Cancelación administrativa
- **WHEN** un administrador cancela un proceso abierto e informa un motivo
- **THEN** el sistema lo deja ineditable y no publicable, conserva su trazabilidad y habilita la preparación de un nuevo proceso

### Requirement: Matriz de criterios y cálculo ponderado
El sistema MUST solicitar para cada evaluación cinco puntajes enteros entre 0 y 10: innovación y originalidad con peso 25 %, impacto potencial con peso 25 %, viabilidad técnica con peso 20 %, presentación y comunicación con peso 15 %, y trabajo en equipo con peso 15 %. El sistema SHALL calcular el total ponderado en escala de 0 a 10.

#### Scenario: Cálculo de una evaluación
- **WHEN** los puntajes son 8, 7, 9, 6 y 10 respectivamente
- **THEN** el sistema calcula el total como `8×0,25 + 7×0,25 + 9×0,20 + 6×0,15 + 10×0,15 = 7,95`

#### Scenario: Puntaje decimal
- **WHEN** el jurado intenta guardar un valor con decimales
- **THEN** el sistema rechaza ese criterio e indica que solamente admite números enteros

#### Scenario: Puntaje fuera de rango
- **WHEN** el jurado intenta guardar un valor menor que 0 o mayor que 10
- **THEN** el sistema rechaza la operación sin modificar la evaluación anterior

#### Scenario: Pesos oficiales
- **WHEN** el sistema presenta o calcula una evaluación
- **THEN** muestra y aplica exactamente los cinco criterios y ponderaciones definidos sin permitir que el jurado los cambie

### Requirement: Portal privado del jurado
El sistema SHALL mostrar a cada jurado autenticado todos los equipos de la instantánea, su progreso personal y solamente sus propias evaluaciones, sin revelar los puntajes ni borradores de otros jurados.

#### Scenario: Jurado consulta su trabajo
- **WHEN** un jurado abre su portal durante un proceso activo
- **THEN** el sistema lista todos los equipos requeridos e identifica cuáles están pendientes, en borrador o finalizados por ese jurado

#### Scenario: Acceso a evaluación ajena
- **WHEN** un jurado intenta consultar o modificar una evaluación perteneciente a otro jurado
- **THEN** el sistema deniega la operación sin revelar sus puntajes

#### Scenario: Usuario sin rol Jurado
- **WHEN** una persona sin un jurado activo intenta abrir el portal o sus operaciones
- **THEN** el sistema deniega el acceso sin revelar la nómina ni las evaluaciones

### Requirement: Borrador y finalización
El sistema SHALL permitir que el jurado guarde puntajes parciales como borrador y SHALL permitir finalizar solamente cuando los cinco criterios contengan enteros válidos. Una evaluación finalizada MUST quedar bloqueada para el jurado.

#### Scenario: Guardado parcial
- **WHEN** el jurado completa uno o más criterios válidos y guarda un borrador
- **THEN** el sistema conserva los valores ingresados y mantiene la evaluación en estado borrador

#### Scenario: Finalización incompleta
- **WHEN** el jurado intenta finalizar sin puntuar todos los criterios
- **THEN** el sistema rechaza la finalización, conserva el borrador e identifica los criterios faltantes

#### Scenario: Finalización válida
- **WHEN** el jurado finaliza una evaluación completa y vigente
- **THEN** el sistema guarda los cinco puntajes, el total ponderado y la fecha de finalización de forma atómica

#### Scenario: Edición posterior del jurado
- **WHEN** el jurado intenta modificar una evaluación finalizada
- **THEN** el sistema rechaza la operación e indica que requiere reapertura administrativa

#### Scenario: Escritura concurrente
- **WHEN** la evaluación cambia después de ser consultada y antes de guardar o finalizar
- **THEN** el sistema rechaza la versión obsoleta y solicita recargar sin sobrescribir el cambio vigente

### Requirement: Seguimiento y reapertura administrativa
El sistema SHALL permitir que los administradores consulten el avance global y el detalle de cada evaluación, y SHALL permitir reabrir una evaluación finalizada únicamente antes de la publicación, registrando la intervención.

#### Scenario: Matriz de avance
- **WHEN** un administrador abre la sección Evaluación
- **THEN** el sistema muestra totales y estados por jurado y equipo, incluyendo cuántas evaluaciones faltan para completar el proceso

#### Scenario: Consulta administrativa
- **WHEN** un administrador selecciona una evaluación
- **THEN** el sistema muestra sus cinco puntajes, total ponderado, estado, jurado, equipo y fechas relevantes

#### Scenario: Reapertura previa a publicación
- **WHEN** un administrador reabre una evaluación finalizada e informa un motivo
- **THEN** el sistema vuelve a dejarla como borrador, bloquea la publicación hasta su nueva finalización y audita el cambio

#### Scenario: Reapertura posterior a publicación
- **WHEN** un administrador intenta reabrir una evaluación después de publicar los resultados
- **THEN** el sistema rechaza la operación y conserva el resultado publicado

### Requirement: Consolidación y publicación completa
El sistema SHALL considerar completo el proceso solamente cuando todas las evaluaciones de la instantánea estén finalizadas, SHALL calcular para cada equipo el promedio aritmético de los totales ponderados de todos los jurados incluidos y MUST impedir la publicación antes de esa condición.

#### Scenario: Evaluaciones pendientes
- **WHEN** al menos una combinación jurado-equipo permanece pendiente o en borrador
- **THEN** el sistema informa el faltante y mantiene deshabilitada la publicación

#### Scenario: Proceso completo
- **WHEN** todos los jurados finalizaron todos los equipos
- **THEN** el sistema marca la evaluación como completa y habilita la publicación administrativa

#### Scenario: Promedio del equipo
- **WHEN** los totales finalizados de un equipo son 7,50, 8,00 y 8,50
- **THEN** el sistema calcula su resultado consolidado como 8,00 sin excluir a ningún jurado de la instantánea

#### Scenario: Publicación administrativa
- **WHEN** un administrador publica un proceso completo
- **THEN** el sistema fija los resultados consolidados y la fecha de publicación de forma atómica

#### Scenario: Publicación anticipada o repetida
- **WHEN** un administrador intenta publicar un proceso incompleto o ya publicado
- **THEN** el sistema rechaza la operación y conserva el estado vigente

### Requirement: Privacidad y trazabilidad de resultados
El sistema MUST mantener privados los borradores y las evaluaciones individuales frente a participantes y terceros, SHALL exponer a los administradores el detalle necesario para gestionar el proceso y SHALL auditar altas, cambios de nómina, apertura, finalizaciones, reaperturas y publicación sin registrar credenciales.

#### Scenario: Equipo antes de la publicación
- **WHEN** un integrante consulta sus resultados antes de la publicación
- **THEN** el sistema informa que todavía no están disponibles sin revelar puntajes, avance ni identidad de jurados

#### Scenario: Equipo después de la publicación
- **WHEN** un integrante de un equipo consulta un proceso publicado
- **THEN** el sistema entrega solamente los promedios consolidados de su propio equipo por criterio y el total general, sin evaluaciones individuales ni identidades de jurados

#### Scenario: Consulta de otro equipo
- **WHEN** un participante intenta obtener el resultado de un equipo al que no pertenece
- **THEN** el sistema deniega la consulta sin revelar si existe o cuál fue su puntaje
