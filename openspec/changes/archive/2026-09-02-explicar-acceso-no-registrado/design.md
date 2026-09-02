## Context

La motivación se describe en [proposal.md](./proposal.md). La ruta de bootstrap ya consulta candidatos, inscripciones docentes, perfiles de mentor y administradores, y la política devuelve `email_not_authorized` cuando ninguna fuente habilita la identidad. Sin embargo, la ruta responde con un texto genérico y el cliente descarta tanto ese texto como el código; además, el error producido al revalidar una sesión existente se silencia. Los comportamientos observables requeridos están definidos en [specs/google-access/spec.md](./specs/google-access/spec.md).

## Goals / Non-Goals

**Goals:**

- Mantener la decisión de autorización en el servidor y tratar al cliente sólo como responsable de presentar el resultado.
- Producir el mismo mensaje público para un intento de inicio de sesión no autorizado y para una sesión revalidada que perdió todos sus permisos.
- Limpiar las credenciales locales antes de presentar el rechazo.
- Diferenciar el rechazo por falta de registro de las fallas o cancelaciones del proveedor OAuth.

**Non-Goals:**

- Cambiar qué registros habilitan a alumnos, docentes o administradores.
- Crear usuarios, modificar el padrón o alterar el esquema de PocketBase.
- Revelar al visitante qué registro concreto falta, existe o fue desactivado.

## Decisions

### 1. Mantener la autorización en el bootstrap del servidor

La ruta de bootstrap seguirá siendo la fuente de verdad y continuará delegando la evaluación de roles a la política existente. Cuando la política devuelva `email_not_authorized`, la respuesta tendrá estado 403, conservará ese código estable y usará el mensaje público acordado.

**Alternativa considerada:** comprobar el padrón desde la pantalla de acceso. Se descarta porque duplicaría reglas de autorización en el navegador y podría exponer información del padrón.

### 2. Resolver mensajes públicos a partir de códigos conocidos

Se definirá un texto reutilizable para `email_not_authorized`: “Según los registros de la plataforma, tu cuenta no está registrada. Para solicitar asistencia, comunicate con los organizadores del evento.” El cliente interpretará la respuesta estructurada del bootstrap y sólo mostrará textos públicos asociados a códigos conocidos; una respuesta inesperada conservará el mensaje genérico de inicio de sesión.

**Alternativa considerada:** mostrar cualquier campo `message` recibido del servidor. Se descarta para impedir que errores internos o futuros detalles técnicos lleguen sin control a la interfaz.

### 3. Conservar el rechazo en el estado de autenticación

El proveedor de autenticación expondrá un error visible junto con el usuario y el estado de carga. Tanto el flujo OAuth iniciado por el botón como la revalidación inicial de una sesión podrán establecerlo. La pantalla de acceso renderizará ese error con `role="alert"`, lo limpiará al reintentar y el cierre de sesión eliminará también el estado residual.

**Alternativa considerada:** mantener el error sólo en el estado local de la pantalla. Se descarta porque no permite comunicar el rechazo detectado durante la revalidación inicial realizada por el proveedor.

### 4. Limpiar la sesión antes de exponer el estado no autorizado

Ante cualquier respuesta no exitosa del bootstrap se limpiará el almacén local de autenticación. El rol participante y el usuario visible quedarán vacíos antes de mostrar la pantalla de acceso. Esto evita que datos de una sesión previa permanezcan disponibles mientras se informa el rechazo.

## Risks / Trade-offs

- [Una falla temporal del bootstrap podría parecer un problema de acceso] → Sólo mapear `email_not_authorized` al mensaje de cuenta no registrada; para otros códigos y errores de red usar el aviso genérico y permitir reintentar.
- [El texto podría diferir entre servidor, cliente y pruebas] → Mantener una constante compartida o una función única de resolución de mensajes y verificar el texto mediante pruebas.
- [Una cuenta desactivada recibe el mismo mensaje que una inexistente] → Es deliberado: cumple el contrato sin revelar el estado interno del padrón y dirige ambos casos a la organización.

## Migration Plan

1. Incorporar el mensaje público y su propagación sin cambios de datos.
2. Ejecutar pruebas unitarias del bootstrap y del proveedor/pantalla, seguidas por las verificaciones generales del proyecto.
3. Desplegar la aplicación normalmente; no se requieren migraciones ni tareas de backfill.

El rollback consiste en revertir los cambios de código de autenticación e interfaz. Los datos y las colecciones permanecen intactos.
