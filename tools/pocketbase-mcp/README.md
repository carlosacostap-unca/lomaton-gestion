# MCP de PocketBase para Lomatón

Servidor MCP local registrado en Codex como `pocketbase-lomaton-production`.
Está fijado al host de producción `https://pb-lomaton.epixum.com` y rechaza
cualquier URL distinta o sin HTTPS.

## Credenciales

Las credenciales no se guardan en este directorio ni en la configuración global
de Codex. Deben definirse en el archivo raíz `.env.local`, que está ignorado por
Git:

```dotenv
POCKETBASE_SUPERUSER_EMAIL=superusuario-de-pocketbase@ejemplo.com
POCKETBASE_SUPERUSER_PASSWORD=contraseña-del-superusuario
```

También puede utilizarse temporalmente `POCKETBASE_SUPERUSER_TOKEN` en lugar del
email y la contraseña.

No se deben enviar estas credenciales por chat ni incluirlas en `.env.example`.

## Protecciones de producción

- `POCKETBASE_EXPECTED_HOST=pb-lomaton.epixum.com` impide apuntar accidentalmente
  a otro servidor.
- `POCKETBASE_ALLOW_WRITES=false` bloquea creaciones y modificaciones.
- `POCKETBASE_ALLOW_DELETES=false` bloquea eliminaciones incluso si se habilitan
  las escrituras.

Las escrituras deben habilitarse solamente durante una operación planificada. Las
eliminaciones requieren habilitar ambos interruptores de forma explícita.

Después de modificar `.env.local` hay que iniciar una nueva tarea de Codex para
que el servidor MCP vuelva a cargar las credenciales.
