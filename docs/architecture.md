# Arquitectura de Lomatón Gestión

## Topología confirmada

Sólo existen dos contextos de ejecución de Next.js: desarrollo local y producción. Ambos usan el PocketBase de producción en `https://pb-lomaton.epixum.com`; no existe staging. Next.js y PocketBase son aplicaciones separadas en Dokploy. Un push a `main` despliega exclusivamente Next.js y nunca modifica el esquema de PocketBase.

PocketBase 0.40.1 es la fuente de verdad. Los cambios de esquema, API Rules y Settings se aplican de forma explícita mediante el MCP `pocketbase-lomaton-production`, con backup previo y eliminaciones deshabilitadas. La definición esperada está versionada en `tools/pocketbase-mcp/lomaton-schema.mjs`.

## Frontera de seguridad

El navegador usa el SDK de PocketBase sólo para Google OAuth2, conservar el token del usuario y realizar lecturas permitidas por API Rules. Toda mutación de dominio llama a un Route Handler de Next.js bajo `/api/lomaton/**` o a las rutas locales de importación/exportación.

Cada Route Handler:

1. recibe el token del usuario en `Authorization`;
2. lo valida con `users/auth-refresh` en un cliente aislado;
3. comprueba el rol requerido: estudiante, docente, jurado o administrador;
4. crea otro cliente PocketBase y autentica la colección `service_accounts`;
5. valida entradas y estado actual;
6. envía las escrituras relacionadas mediante API Batch.

La cuenta técnica tiene `role=lomaton_server`, `active=true` y reglas de mínimo privilegio. Sus credenciales viven únicamente en `.env.local` y en las variables privadas del despliegue Next.js. El runtime no utiliza `_superusers`.

## OAuth y permisos

`users` mantiene habilitado sólo Google OAuth2. Su `authRule` exige email verificado y presencia activa como estudiante, docente, jurado o administrador. Después de OAuth, el bootstrap sincroniza las relaciones de participante y jurado, el permiso administrativo, el estado habilitado y el nombre visible usando la cuenta técnica. Una misma identidad puede conservar varias áreas y cada Route Handler vuelve a verificar el rol concreto.

## Integridad concurrente

Los índices únicos impiden dos equipos por candidato, nombres normalizados duplicados e invitaciones pendientes duplicadas. Las incorporaciones actualizan `teams.memberCount` con una precondición `expected_member_count`; si dos solicitudes compiten por el cuarto lugar, una transacción completa falla. Cada Batch incluye membresía, invitaciones, proyección de estado y `hackathon_settings.dataVersion`.

Los reportes leen `dataVersion` antes y después de la instantánea y reintentan si hubo cambios. Importaciones, intervenciones administrativas y configuración incluyen auditoría inmutable en la misma transacción.

La entrega del hackathon es un único agregado compartido por equipo en `team_deliverables`. Sus cinco productos son Presentación (archivo o enlace), Canvas (archivo), Informe (archivo), Evidencia del desarrollo alcanzado (archivo o enlace) y Video (enlace opcional). Cada mutación exige la versión observada, respeta `hackathon_settings.deliverablesDeadlineUtc`, limpia la modalidad alternativa, incrementa versión y registra auditoría en el mismo Batch. Editar una entrega finalizada la devuelve a borrador; finalizar exige los cuatro productos obligatorios.

Los archivos están protegidos en PocketBase. El navegador nunca recibe la URL interna, el token temporal ni el hash: descarga por un Route Handler que revalida integrante, administrador o jurado y transmite la respuesta con `no-store`. Las listas de administración y jurado son proyecciones de solo lectura e incluyen equipos sin registro de entrega.

La evaluación congela jurados, equipos, criteriaVersion y una instantánea validada de la rúbrica al abrir un ciclo, y crea en un único Batch cada combinación jurado-equipo. Los ciclos históricos lomaton-2026-v1 conservan cinco puntajes enteros 0–10. Todo ciclo nuevo usa lomaton-2026-planilla-v2: trece puntajes enteros 1–5, observación privada opcional por aspecto, promedio por criterio y total ponderado sobre 100.

La matriz v2 mantiene literalmente estos grupos:

- Innovación y originalidad (25%): “Grado de novedad de la propuesta frente al desafío”, “Diferenciación respecto de alternativas convencionales” e “Integración original de ideas, tecnologías o enfoques”.
- Impacto potencial (25%): “Relevancia del problema que busca resolver”, “Aporte económico, social, ambiental y/o productivo” y “Posibilidad de medir y sostener el impacto esperado”.
- Viabilidad técnica (20%): “Coherencia técnica entre problema y solución”, “Factibilidad de acceso a recursos, tecnologías y conocimientos necesarios” e “Identificación de riesgos o aspectos por validar”.
- Presentación y comunicación (15%): “Claridad para explicar problema, solución y funcionamiento”, “Organización y capacidad de síntesis en el tiempo disponible” y “Calidad y utilidad de recursos visuales/evidencias”.
- Trabajo en equipo (15%): “Integración de conocimientos, disciplinas y perspectivas diversas”.

La escala es 1 = Muy bajo / insuficiente, 2 = Bajo, 3 = Adecuado, 4 = Muy bueno y 5 = Excelente. Por criterio, promedio = sumaAspectos / cantidadAspectos y ponderado = sumaAspectos × peso / (cantidadAspectos × 5). El servidor usa fracciones enteras y redondea a dos decimales sólo al presentar o fijar el agregado. Finalizar, reabrir, cancelar y publicar actualizan estado, versión, contadores y auditoría atómicamente. El portal estudiantil recibe sólo los cinco promedios consolidados y el total; nunca recibe aspectos, observaciones, identidades ni evaluaciones individuales. Aunque teams.challenge exista como dato opcional, mostrar “Desafío” en el instrumento de evaluación queda fuera de alcance hasta definir una fuente y regla de carga autoritativas para el ciclo.

## Guías de Next.js 16 consultadas

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`
- `node_modules/next/dist/docs/01-app/02-guides/data-security.md`
- `node_modules/next/dist/docs/01-app/02-guides/server-and-client-boundary.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/02-guides/forms.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`

Las decisiones resultantes son: parámetros de rutas esperados como promesas, autenticación y autorización dentro de cada handler, módulos privados con `server-only`, validación de todo dato externo, DTOs limitados y ausencia de clientes globales con sesión de usuario.
