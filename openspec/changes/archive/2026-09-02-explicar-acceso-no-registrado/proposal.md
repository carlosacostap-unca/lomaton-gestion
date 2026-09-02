## Why

La plataforma ya contrasta el email autenticado con el padrón y la autorización administrativa, pero la pantalla de acceso reemplaza el rechazo específico por un mensaje genérico. Las personas cuya cuenta no está registrada necesitan saber con claridad por qué no pueden ingresar y a quién recurrir, sin debilitar el control de acceso.

## What Changes

- Mantener el acceso limitado a alumnos activos del padrón, docentes con perfil de mentor activo y administradores expresamente autorizados.
- Rechazar cualquier otra cuenta sin conservar una sesión autenticada en la aplicación.
- Informar de manera explícita que, según los registros de la plataforma, la cuenta no está registrada y que la persona debe comunicarse con los organizadores del evento.
- Preservar mensajes diferenciados para cancelaciones o fallas de Google y para identidades no verificadas, sin revelar información sensible del padrón.
- Incorporar pruebas del rechazo y de la presentación del mensaje en la pantalla de acceso.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `google-access`: precisa el comportamiento y el mensaje visible cuando una identidad autenticada no corresponde a un alumno, docente o administrador registrado.

## Impact

- Ruta de inicialización de sesión y política de autorización.
- Proveedor de autenticación y pantalla de acceso.
- Pruebas unitarias y de interfaz del flujo de autenticación.
- No requiere cambios en el esquema de PocketBase, migraciones ni modificaciones del padrón existente.
