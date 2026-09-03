## Why

La plataforma todavía no representa a los jurados ni ofrece un circuito confiable para evaluar a todos los equipos con criterios comunes. Incorporar esta función permitirá centralizar puntajes, controlar que la evaluación esté completa y publicar resultados consistentes sin cálculos manuales.

## What Changes

- Añadir el rol Jurado, administrado mediante nombre y correo por usuarios administradores, con acceso restringido a cuentas registradas y activas.
- Incorporar una sección administrativa de Jurados y otra de Evaluación para gestionar la nómina, abrir el proceso, seguir el avance, revisar puntajes y publicar resultados.
- Congelar al abrir la evaluación la nómina de jurados activos y equipos evaluables, generando una evaluación obligatoria para cada combinación jurado-equipo.
- Permitir que cada jurado puntúe con números enteros de 0 a 10 los cinco criterios definidos: innovación y originalidad (25 %), impacto potencial (25 %), viabilidad técnica (20 %), presentación y comunicación (15 %) y trabajo en equipo (15 %).
- Calcular automáticamente el total ponderado de cada evaluación en escala 0 a 10 y el resultado de cada equipo como promedio de los totales de todos los jurados.
- Permitir guardar borradores y finalizar evaluaciones; una evaluación finalizada queda bloqueada, salvo reapertura administrativa auditada antes de publicar.
- Impedir la publicación hasta que todos los jurados hayan finalizado todos los equipos y, una vez publicada, mostrar a cada equipo solamente sus resultados consolidados.
- Mantener privados los borradores, las evaluaciones individuales y la identidad asociada a cada puntaje frente a los equipos.

## Capabilities

### New Capabilities

- `jury-evaluation`: alta y estado de jurados, apertura del proceso, asignación completa jurado-equipo, carga y finalización de puntajes, cálculo ponderado, seguimiento administrativo, cierre y publicación de resultados.

### Modified Capabilities

- `google-access`: autorizar el acceso del nuevo rol Jurado únicamente cuando el correo autenticado coincida con un jurado activo registrado.
- `admin-workspace`: incorporar las secciones Jurados y Evaluación al espacio administrativo manteniendo navegación aislada, enlazable y adaptable.
- `participant-self-service`: permitir que los integrantes de un equipo consulten su resultado consolidado solamente después de la publicación administrativa.

## Impact

- Nuevas colecciones y reglas de acceso para jurados, ciclos de evaluación, asignaciones jurado-equipo, puntajes y publicación.
- Nuevas rutas privadas para el portal del jurado y nuevas secciones del panel administrativo.
- Nuevas operaciones autenticadas para borradores, finalización, reapertura administrativa y publicación.
- Extensión del arranque de sesión para proyectar el rol Jurado sin otorgar permisos de estudiante, docente o administrador.
- Actualización del portal de participantes para exponer resultados consolidados publicados sin revelar evaluaciones individuales.
- Pruebas de dominio, autorización, cálculo, concurrencia, componentes y recorridos E2E.
