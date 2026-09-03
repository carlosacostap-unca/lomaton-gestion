## 1. Preparar la proyección docente

- [x] 1.1 Leer las guías instaladas de Next.js 16 pertinentes a rutas, componentes cliente y navegación antes de modificar la aplicación, y verificar que las decisiones usen las APIs vigentes del proyecto.
- [x] 1.2 Implementar una proyección tipada basada en inscripciones docentes que componga perfiles de mentor, equipos y mentorías, y verificar con pruebas unitarias la exclusión de otros roles, afiliación faltante, elegibilidad, ausencia de perfil y múltiples equipos.
- [x] 1.3 Exponer la proyección mediante `/api/lomaton/admin/teachers` usando la autorización administrativa existente, y verificar con pruebas de ruta que la respuesta mínima no incluya DNI, teléfono ni otros datos privados y que se deniegue a usuarios no administrativos.

## 2. Construir la gestión de docentes

- [x] 2.1 Crear el directorio que cargue automáticamente docentes, disponibilidad y todos sus equipos, y verificar mediante pruebas de componente los estados disponible, no disponible, sin equipos, con varios equipos y directorio vacío.
- [x] 2.2 Añadir búsqueda por nombre, afiliación o equipo y filtro de disponibilidad en una lista compacta con controles por docente bajo demanda, verificando coincidencias, ausencia de resultados y que estudiantes no aparezcan.
- [x] 2.3 Permitir asignar un equipo adicional reutilizando la operación administrativa vigente, impedir duplicar la misma asignación y presentar confirmación explícita al reemplazar otro mentor, verificando los tres recorridos con pruebas de componente y dominio existentes.
- [x] 2.4 Permitir retirar una mentoría individual sin afectar las restantes y refrescar el directorio después de asignar, reemplazar o retirar, verificando éxito, motivo requerido, error accionable y conservación del estado ante fallos.

## 3. Integrar navegación y experiencia adaptable

- [x] 3.1 Añadir `/admin/docentes` y la opción Docentes al menú, y verificar que existan exactamente siete destinos, que el enlace activo sea correcto y que el acceso no administrativo permanezca bloqueado.
- [x] 3.2 Incorporar estados accesibles de carga y reintento, foco visible, etiquetas explícitas y estilos responsivos sin tablas horizontales, y verificar navegación por teclado y ausencia de desplazamiento horizontal en pantalla estrecha.
- [x] 3.3 Actualizar las pruebas E2E administrativas para cubrir navegación a Docentes, visualización de varias mentorías, asignación adicional, reemplazo confirmado, retiro independiente, recarga y recorrido móvil.

## 4. Validación integral

- [x] 4.1 Ejecutar `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` y `npm run build`, y corregir cualquier regresión hasta que todas las verificaciones aplicables finalicen correctamente.
- [x] 4.2 Validar el cambio con OpenSpec en modo estricto y revisar manualmente que no agregue un límite por docente, no permita más de un mentor por equipo y no exponga información personal innecesaria.
