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
El sistema SHALL permitir que un administrador abra un único proceso de evaluación tomando una instantánea de todos los jurados activos, todos los equipos existentes no disueltos y la versión vigente de la matriz de evaluación, y MUST crear exactamente una evaluación para cada combinación jurado-equipo.

#### Scenario: Apertura válida
- **WHEN** existe al menos un jurado activo y al menos un equipo evaluable y el administrador abre la evaluación
- **THEN** el sistema congela ambas nóminas, fija la matriz oficial de trece aspectos y genera la cobertura completa de jurados por equipos sin duplicados

#### Scenario: Apertura sin participantes suficientes
- **WHEN** no existe al menos un jurado activo o un equipo evaluable
- **THEN** el sistema rechaza la apertura e informa qué nómina está vacía

#### Scenario: Segundo proceso simultáneo
- **WHEN** un administrador intenta abrir otro proceso mientras existe uno abierto
- **THEN** el sistema rechaza la operación y conserva el proceso vigente

#### Scenario: Equipo incorporado después de la apertura
- **WHEN** se crea o modifica un equipo después de congelar la nómina
- **THEN** ese cambio no altera silenciosamente las evaluaciones requeridas por el proceso abierto

#### Scenario: Cambio posterior de la definición
- **WHEN** la definición oficial de evaluación cambia después de abrir un ciclo
- **THEN** el ciclo conserva la versión y los aspectos con los que fue abierto sin mezclar contratos de puntuación

#### Scenario: Ciclo anterior a la nueva planilla
- **WHEN** existe un ciclo creado con la matriz anterior de cinco puntajes de 0 a 10
- **THEN** el sistema conserva su versión, sus registros y su presentación histórica sin convertirlos en puntajes por aspecto

#### Scenario: Cancelación administrativa
- **WHEN** un administrador cancela un proceso abierto e informa un motivo
- **THEN** el sistema lo deja ineditable y no publicable, conserva su trazabilidad y habilita la preparación de un nuevo proceso

### Requirement: Matriz de criterios y cálculo ponderado
El sistema MUST solicitar trece puntajes enteros entre 1 y 5 distribuidos exactamente en los aspectos oficiales: tres para Innovación y originalidad con peso 25 %, tres para Impacto potencial con peso 25 %, tres para Viabilidad técnica con peso 20 %, tres para Presentación y comunicación con peso 15 % y uno para Trabajo en equipo con peso 15 %. El sistema SHALL promediar los aspectos de cada criterio, SHALL calcular su puntaje ponderado como `promedio ÷ 5 × peso sobre 100` y SHALL sumar los cinco ponderados para obtener el total de la evaluación sobre 100.

#### Scenario: Aspectos de Innovación y originalidad
- **WHEN** el sistema presenta ese criterio
- **THEN** solicita “Grado de novedad de la propuesta frente al desafío”, “Diferenciación respecto de alternativas convencionales” e “Integración original de ideas, tecnologías o enfoques”

#### Scenario: Aspectos de Impacto potencial
- **WHEN** el sistema presenta ese criterio
- **THEN** solicita “Relevancia del problema que busca resolver”, “Aporte económico, social, ambiental y/o productivo” y “Posibilidad de medir y sostener el impacto esperado”

#### Scenario: Aspectos de Viabilidad técnica
- **WHEN** el sistema presenta ese criterio
- **THEN** solicita “Coherencia técnica entre problema y solución”, “Factibilidad de acceso a recursos, tecnologías y conocimientos necesarios” e “Identificación de riesgos o aspectos por validar”

#### Scenario: Aspectos de Presentación y comunicación
- **WHEN** el sistema presenta ese criterio
- **THEN** solicita “Claridad para explicar problema, solución y funcionamiento”, “Organización y capacidad de síntesis en el tiempo disponible” y “Calidad y utilidad de recursos visuales/evidencias”

#### Scenario: Aspecto de Trabajo en equipo
- **WHEN** el sistema presenta ese criterio
- **THEN** solicita únicamente “Integración de conocimientos, disciplinas y perspectivas diversas”

#### Scenario: Cálculo de una evaluación
- **WHEN** los aspectos reciben respectivamente `[5,4,3]`, `[4,4,4]`, `[3,3,3]`, `[5,5,4]` y `[4]`
- **THEN** el sistema calcula promedios 4,00; 4,00; 3,00; 4,67 y 4,00, ponderados 20,00; 20,00; 12,00; 14,00 y 12,00, y un total de 78,00 sobre 100

#### Scenario: Redondeo determinista
- **WHEN** un promedio o ponderado posee más de dos decimales
- **THEN** el sistema calcula con la precisión exacta de los puntajes enteros y redondea a dos decimales solamente al presentar o fijar el resultado

#### Scenario: Puntaje decimal
- **WHEN** el jurado intenta guardar un valor decimal para un aspecto de la nueva matriz
- **THEN** el sistema rechaza ese aspecto sin modificar la evaluación anterior

#### Scenario: Puntaje fuera de rango
- **WHEN** el jurado intenta guardar un valor menor que 1 o mayor que 5 para un aspecto de la nueva matriz
- **THEN** el sistema rechaza ese aspecto sin modificar la evaluación anterior

#### Scenario: Escala visible
- **WHEN** el jurado completa un aspecto
- **THEN** el sistema presenta `1 = Muy bajo / insuficiente`, `2 = Bajo`, `3 = Adecuado`, `4 = Muy bueno` y `5 = Excelente`

#### Scenario: Pesos oficiales
- **WHEN** el sistema presenta o calcula una evaluación
- **THEN** muestra y aplica máximos de 25, 25, 20, 15 y 15 puntos sin permitir que el jurado cambie aspectos, escalas ni ponderaciones

### Requirement: Portal privado del jurado
El sistema SHALL mostrar a cada jurado autenticado todos los equipos de la instantánea, su progreso personal y solamente sus propias evaluaciones, agrupando los trece aspectos según la planilla y sin revelar puntajes, observaciones ni borradores de otros jurados.

#### Scenario: Jurado consulta su trabajo
- **WHEN** un jurado abre su portal durante un proceso activo
- **THEN** el sistema lista todos los equipos requeridos e identifica cuáles están pendientes, en borrador o finalizados por ese jurado

#### Scenario: Jurado abre un equipo
- **WHEN** el jurado selecciona una evaluación propia
- **THEN** el sistema muestra equipo o proyecto, identidad del jurado, criterios, pesos, aspectos, puntajes 1–5, promedios, ponderados, máximos y observaciones

#### Scenario: Desafío no disponible
- **WHEN** la plataforma no posee un desafío asociado al equipo
- **THEN** el portal no inventa ese dato ni obliga al jurado a completarlo

#### Scenario: Acceso a evaluación ajena
- **WHEN** un jurado intenta consultar o modificar una evaluación perteneciente a otro jurado
- **THEN** el sistema deniega la operación sin revelar sus puntajes ni observaciones

#### Scenario: Usuario sin rol Jurado
- **WHEN** una persona sin un jurado activo intenta abrir el portal o sus operaciones
- **THEN** el sistema deniega el acceso sin revelar la nómina ni las evaluaciones

### Requirement: Borrador y finalización
El sistema SHALL permitir que el jurado guarde puntajes y observaciones parciales como borrador y SHALL permitir finalizar solamente cuando los trece aspectos contengan enteros válidos de 1 a 5. Una evaluación finalizada MUST quedar bloqueada para el jurado.

#### Scenario: Guardado parcial
- **WHEN** el jurado completa uno o más aspectos válidos, añade observaciones opcionales y guarda un borrador
- **THEN** el sistema conserva los valores ingresados y mantiene la evaluación en estado borrador

#### Scenario: Observación sin puntaje
- **WHEN** el jurado escribe una observación para un aspecto todavía no puntuado y guarda un borrador
- **THEN** el sistema conserva la observación sin considerar completo ese aspecto

#### Scenario: Finalización incompleta
- **WHEN** el jurado intenta finalizar sin puntuar los trece aspectos
- **THEN** el sistema rechaza la finalización, conserva el borrador e identifica los aspectos faltantes

#### Scenario: Finalización válida
- **WHEN** el jurado finaliza una evaluación completa y vigente
- **THEN** el sistema guarda atómicamente los trece puntajes, las observaciones, los cinco promedios, los cinco ponderados, el total y la fecha de finalización

#### Scenario: Edición posterior del jurado
- **WHEN** el jurado intenta modificar una evaluación finalizada
- **THEN** el sistema rechaza la operación e indica que requiere reapertura administrativa

#### Scenario: Escritura concurrente
- **WHEN** la evaluación cambia después de ser consultada y antes de guardar o finalizar
- **THEN** el sistema rechaza la versión obsoleta y solicita recargar sin sobrescribir el cambio vigente

### Requirement: Seguimiento y reapertura administrativa
El sistema SHALL permitir que los administradores consulten el avance global y el detalle completo de cada evaluación por aspecto, y SHALL permitir reabrir una evaluación finalizada únicamente antes de la publicación, registrando la intervención.

#### Scenario: Matriz de avance
- **WHEN** un administrador abre la sección Evaluación
- **THEN** el sistema muestra totales y estados por jurado y equipo, incluyendo cuántas evaluaciones faltan para completar el proceso

#### Scenario: Consulta administrativa
- **WHEN** un administrador selecciona una evaluación de la nueva matriz
- **THEN** el sistema muestra sus trece puntajes, observaciones, promedios por criterio, ponderados, total, estado, jurado, equipo y fechas relevantes

#### Scenario: Consulta administrativa histórica
- **WHEN** un administrador selecciona una evaluación creada con la matriz anterior
- **THEN** el sistema presenta los cinco puntajes históricos y su escala original sin reinterpretarlos como aspectos 1–5

#### Scenario: Reapertura previa a publicación
- **WHEN** un administrador reabre una evaluación finalizada e informa un motivo
- **THEN** el sistema vuelve a dejarla como borrador, bloquea la publicación hasta su nueva finalización y audita el cambio

#### Scenario: Reapertura posterior a publicación
- **WHEN** un administrador intenta reabrir una evaluación después de publicar los resultados
- **THEN** el sistema rechaza la operación y conserva el resultado publicado

### Requirement: Consolidación y publicación completa
El sistema SHALL considerar completo el proceso solamente cuando todas las evaluaciones de la instantánea estén finalizadas, SHALL calcular para cada equipo el promedio aritmético de los promedios por criterio y de los totales sobre 100 de todos los jurados incluidos, y MUST impedir la publicación antes de esa condición.

#### Scenario: Evaluaciones pendientes
- **WHEN** al menos una combinación jurado-equipo permanece pendiente o en borrador
- **THEN** el sistema informa el faltante y mantiene deshabilitada la publicación

#### Scenario: Proceso completo
- **WHEN** todos los jurados finalizaron todos los equipos con los trece aspectos puntuados
- **THEN** el sistema marca la evaluación como completa y habilita la publicación administrativa

#### Scenario: Promedio del equipo
- **WHEN** los totales finalizados de un equipo son 78,00; 82,00 y 80,00
- **THEN** el sistema calcula su resultado consolidado como 80,00 sobre 100 sin excluir a ningún jurado de la instantánea

#### Scenario: Promedios consolidados por criterio
- **WHEN** se publica un equipo evaluado por varios jurados
- **THEN** el sistema fija para cada criterio el promedio de sus promedios individuales en escala 1–5 y fija por separado el total consolidado sobre 100

#### Scenario: Publicación administrativa
- **WHEN** un administrador publica un proceso completo
- **THEN** el sistema fija los resultados consolidados y la fecha de publicación de forma atómica

#### Scenario: Publicación anticipada o repetida
- **WHEN** un administrador intenta publicar un proceso incompleto o ya publicado
- **THEN** el sistema rechaza la operación y conserva el estado vigente

### Requirement: Privacidad y trazabilidad de resultados
El sistema MUST mantener privados los borradores, las observaciones y las evaluaciones individuales frente a participantes y terceros, SHALL exponer a los administradores el detalle necesario para gestionar el proceso y SHALL auditar altas, cambios de nómina, apertura, finalizaciones, reaperturas y publicación sin registrar credenciales.

#### Scenario: Equipo antes de la publicación
- **WHEN** un integrante consulta sus resultados antes de la publicación
- **THEN** el sistema informa que todavía no están disponibles sin revelar puntajes, avance, observaciones ni identidad de jurados

#### Scenario: Equipo después de la publicación
- **WHEN** un integrante de un equipo consulta un proceso publicado con la nueva matriz
- **THEN** el sistema entrega solamente los cinco promedios consolidados en escala 1–5 y el total general sobre 100 de su propio equipo, sin aspectos individuales, observaciones ni identidades de jurados

#### Scenario: Equipo consulta un resultado histórico
- **WHEN** el resultado publicado más reciente del equipo pertenece a la matriz anterior
- **THEN** el sistema conserva su escala original y no lo presenta como un resultado sobre 100

#### Scenario: Consulta de otro equipo
- **WHEN** un participante intenta obtener el resultado de un equipo al que no pertenece
- **THEN** el sistema deniega la consulta sin revelar si existe o cuál fue su puntaje

### Requirement: Consulta de entregables por el jurado
El sistema SHALL permitir que cada jurado activo consulte en modo lectura la entrega vigente de todos los equipos desde su portal, con estado, productos, faltantes y fechas, sin revelar datos de auditoría internos ni otorgar acciones de modificación.

#### Scenario: Equipo con entrega finalizada
- **WHEN** un jurado abre un equipo cuya entrega está finalizada
- **THEN** el portal identifica la finalización y permite abrir o descargar cada producto disponible

#### Scenario: Equipo con borrador
- **WHEN** un jurado abre un equipo cuya entrega permanece en borrador
- **THEN** el portal muestra los productos actualmente guardados y advierte que no se trata de una entrega finalizada y que puede cambiar mientras el plazo esté abierto

#### Scenario: Equipo sin entrega
- **WHEN** un jurado abre un equipo que todavía no cargó productos
- **THEN** el portal informa explícitamente que no posee entrega sin inventar enlaces ni archivos

#### Scenario: Pérdida del rol
- **WHEN** una cuenta deja de corresponder a un jurado activo
- **THEN** el sistema deniega nuevas consultas y descargas de entregables aunque conserve una sesión previa
