## Why

Los candidatos necesitan acreditar su condición de alumno regular dentro de la misma aplicación, sin recurrir a canales externos ni exponer documentación académica al resto de los participantes. PocketBase ya utiliza iDrive E2 como almacenamiento de archivos, por lo que puede conservar estos comprobantes de manera centralizada y privada.

## What Changes

- Permitir que un candidato autenticado cargue o reemplace un único certificado de alumno regular en formato PDF desde su panel.
- Validar extensión, tipo MIME, firma real del PDF y un límite configurable de tamaño antes de persistir el archivo.
- Conservar el archivo y sus metadatos en una colección privada de PocketBase, utilizando el almacenamiento iDrive E2 ya configurado.
- Permitir que el candidato consulte y descargue solamente su propio certificado vigente.
- Permitir que los administradores consulten y descarguen los certificados de los candidatos, sin exponerlos en búsquedas, reportes o exportaciones operativas generales.
- Registrar en auditoría cada alta o reemplazo sin almacenar el contenido del documento en los registros de auditoría.
- No modificar automáticamente el estado FTCA ni incorporar un flujo de aprobación documental en este cambio.

## Capabilities

### New Capabilities

- `student-certificates`: Carga, reemplazo, consulta y descarga privada de certificados PDF de alumno regular por candidatos y administradores.

### Modified Capabilities

Ninguna.

## Impact

- El panel de candidato incorporará el estado del certificado y el formulario de carga o reemplazo.
- El área administrativa incorporará acceso al certificado desde la consulta del candidato.
- Next.js agregará Route Handlers autenticados para cargar, consultar y descargar archivos sin exponer la credencial técnica ni URLs públicas permanentes.
- El esquema versionado de PocketBase y su aplicación explícita mediante MCP incorporarán una colección privada para el archivo y sus metadatos.
- PocketBase almacenará el archivo mediante el backend S3-compatible de iDrive E2 ya configurado; la aplicación no administrará credenciales de iDrive E2.
