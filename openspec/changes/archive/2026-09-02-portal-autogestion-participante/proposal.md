## Why

La aplicación ya permite que los estudiantes gestionen certificados y conformen equipos, pero no ofrece autogestión de los datos importados ni un acceso operativo para docentes. Incorporar un portal por rol completa el circuito del participante y permite sumar mentorías consentidas sin convertir al docente en integrante del equipo.

## What Changes

- Habilitar el acceso con Google de docentes con perfil de mentor activo y vincular la sesión con su inscripción y perfil, sin otorgarles permisos de candidato.
- Ofrecer un portal autenticado adaptado al rol: los estudiantes conservan certificado, equipo e invitaciones; los docentes acceden a su perfil y a su mentoría.
- Permitir que cada participante consulte su propia inscripción privada y actualice solamente los campos de contacto, académicos o descriptivos autorizados para su rol.
- Mantener bajo control administrativo los datos que cambian identidad, elegibilidad o consentimiento: email, DNI, vínculo, estado FTCA, declaraciones históricas y consentimientos.
- Permitir que el responsable de un equipo invite a docentes activos que hayan manifestado interés en mentoría.
- Permitir que el docente consulte, acepte o rechace invitaciones de mentoría. Cada equipo tendrá como máximo un mentor y cada docente podrá ser mentor de como máximo un equipo.
- Cancelar de manera atómica las invitaciones de mentoría incompatibles cuando una aceptación ocupa al docente o al equipo.
- Mantener al mentor fuera del conteo de tres o cuatro integrantes y del cálculo del requisito FTCA.
- Auditar las actualizaciones de perfil y las transiciones de invitaciones y asignaciones de mentoría.

## Capabilities

### New Capabilities

- `participant-self-service`: Portal por rol para consultar la inscripción propia, actualizar campos autorizados y presentar las funciones disponibles para estudiantes y docentes.

### Modified Capabilities

- `google-access`: Autorizar también a docentes con perfil de mentor activo y vincular explícitamente la identidad autenticada con su inscripción y rol.
- `candidate-roster`: Permitir acceso privado a la inscripción propia y actualizaciones acotadas por el participante, preservando identidad, elegibilidad, consentimiento y trazabilidad administrativa.
- `team-formation`: Incorporar invitaciones y asignaciones consentidas de mentoría con exclusividad de un docente por equipo y un equipo por docente, sin afectar membresía ni validez FTCA.

## Impact

- Esquema PocketBase: vínculo de usuario con inscripción/perfil de mentor y nuevas colecciones o relaciones para invitaciones y asignaciones de mentoría, con índices únicos y reglas privadas.
- Autenticación: bootstrap, política de autorización y proyección de rol de la sesión.
- Dominio y API: lectura/actualización de perfil propio y comandos transaccionales para invitar, aceptar, rechazar y cancelar mentorías.
- Interfaz: portal o navegación por rol, formulario de perfil, selector de mentor para responsables de equipo y bandeja docente de invitaciones.
- Administración y reportes: visibilidad de mentorías y auditoría, sin incorporar mentores al conteo de miembros.
- Pruebas: políticas de acceso, privacidad, campos editables, concurrencia y restricciones de unicidad de mentoría.

