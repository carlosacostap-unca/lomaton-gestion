# Despliegue de PocketBase en Dokploy

## Configuración confirmada

| Dato | Valor |
| --- | --- |
| URL pública | `https://pb-lomaton.epixum.com` |
| Versión | `0.40.1` |
| Imagen fijada | `adrianmusante/pocketbase:0.40.1` |
| Administrador inicial de la aplicación | `carlosacostap@tecno.unca.edu.ar` |
| Datos persistentes | `/pocketbase/data` |
| Migraciones versionadas | `/pocketbase/migrations` |
| Hooks versionados | `/pocketbase/hooks` |

La imagen debe quedar fijada a `0.40.1`. Aunque `latest` pueda apuntar hoy a la misma versión, no es reproducible y podría actualizar PocketBase sin una revisión explícita.

La comprobación del 29 de agosto de 2026 confirmó que `GET https://pb-lomaton.epixum.com/api/health` responde con código 200 y que la instancia todavía no tiene colecciones de la aplicación.

## Montajes en Dokploy

El servicio PocketBase debe conservar el volumen existente en `/pocketbase/data`. El despliegue debe incorporar dos directorios del repositorio como montajes de solo lectura o copiarlos dentro de una imagen derivada:

- `pocketbase/pb_migrations` → `/pocketbase/migrations`
- `pocketbase/pb_hooks` → `/pocketbase/hooks`

El proceso se inicia usando esos directorios, por ejemplo con los argumentos equivalentes a:

```text
serve --http=0.0.0.0:8090 --dir=/pocketbase/data --migrationsDir=/pocketbase/migrations --hooksDir=/pocketbase/hooks
```

No se guardan credenciales de `_superusers`, secretos OAuth ni tokens en el repositorio. `ADMIN_EMAILS` contiene únicamente la lista inicial de emails autorizados por la aplicación; no concede por sí misma privilegios de superusuario de PocketBase.

## Respaldo obligatorio antes de migrar producción

Como todavía no existe un respaldo informado de la instancia productiva, no se deben ejecutar allí las migraciones hasta completar estos pasos:

1. Abrir el Dashboard de PocketBase con un `_superuser`.
2. Ir a **Settings → Backups** y crear un respaldo con un nombre fechado, por ejemplo `pre-lomaton-YYYYMMDD-HHMM.zip`.
3. Descargar una copia fuera del VPS y conservar también el ZIP en el volumen persistente.
4. Comprobar que el archivo aparece en la lista, tiene tamaño mayor que cero y puede descargarse.
5. Desplegar y probar las migraciones primero sobre una copia de staging restaurada desde ese ZIP.

Para una copia manual del directorio `/pocketbase/data`, se debe detener PocketBase antes de copiarlo. No se copia una base SQLite activa.

## Restauración de prueba verificada

Se verificó localmente el procedimiento con el binario oficial PocketBase 0.40.1:

1. Se creó un respaldo nativo `baseline-empty-test.zip` de una instancia aislada.
2. Se extrajo el ZIP en un directorio de datos vacío.
3. La copia restaurada arrancó en otro puerto y `GET /api/health` devolvió 200.
4. El `_superuser` de prueba incluido en el respaldo pudo autenticarse en la copia.

La prueba confirma el formato y el procedimiento de restauración con la misma versión. No sustituye el respaldo productivo previo a la primera migración.

## Restaurar en staging

1. Detener el contenedor de staging.
2. Vaciar exclusivamente su volumen de datos, nunca el volumen de producción.
3. Extraer el ZIP de respaldo en `/pocketbase/data`.
4. Iniciar staging con la misma imagen `adrianmusante/pocketbase:0.40.1` y sin aplicar todavía una versión más nueva de las migraciones.
5. Verificar `/api/health`, acceso al Dashboard y presencia de los registros esperados.
6. Montar `pb_migrations` y `pb_hooks`, ejecutar las migraciones y realizar las pruebas de aceptación.

## Rollback

El rollback preferido es ejecutar `migrate down` sobre staging y verificarlo antes de producción. Si una migración no puede revertirse de forma segura:

1. detener el servicio afectado;
2. conservar una copia del volumen fallido para diagnóstico;
3. restaurar el ZIP tomado inmediatamente antes del despliegue;
4. iniciar la misma versión fijada de PocketBase;
5. verificar health, autenticación, colecciones y conteos antes de reabrir el acceso.

Nunca se cambia simultáneamente la versión de PocketBase y el esquema de la aplicación en el mismo despliegue.

## Configurar Google OAuth2

Esta configuración requiere un Client ID y Client Secret que todavía no fueron provistos. No deben guardarse en este repositorio ni como variables del frontend.

1. En Google Cloud, seleccionar o crear el proyecto de la organización y completar **Google Auth Platform → Branding** y **Audience**. Si accederán cuentas fuera del dominio institucional, elegir audiencia externa y agregar usuarios de prueba mientras la aplicación permanezca en modo de prueba.
2. Crear un cliente OAuth de tipo **Web application**.
3. Registrar exactamente esta URI en **Authorized redirect URIs**:

   ```text
   https://pb-lomaton.epixum.com/api/oauth2-redirect
   ```

4. Registrar como **Authorized JavaScript origin** el origen HTTPS donde se desplegará Next.js, sin ruta, por ejemplo `https://equipos.lomaton.example`. El dominio definitivo del frontend todavía debe confirmarse.
5. Copiar el Client ID y el Client Secret a un gestor de secretos. Google sólo vuelve a mostrar el secreto completo al crearlo.
6. En PocketBase, abrir **Collections → users → Options → OAuth2**, habilitar solamente Google y pegar las credenciales.
7. Mantener deshabilitados password y OTP para `users`; la aplicación no administra contraseñas locales.
8. Verificar en staging: login autorizado, cancelación del popup, email no incluido en el padrón, identidad candidata, identidad administradora y cierre de sesión.

PocketBase documenta el callback `/api/oauth2-redirect` para el flujo recomendado con popup: <https://pocketbase.io/docs/authentication/>. Google exige que la URI coincida exactamente y que producción use HTTPS: <https://support.google.com/cloud/answer/15549257>.

## Desplegar Next.js en Dokploy

Configurar estas variables tanto durante el build como en runtime, tomando `.env.example` como fuente de nombres:

- `NEXT_PUBLIC_POCKETBASE_URL=https://pb-lomaton.epixum.com` (obligatoria durante `next build`).
- `POCKETBASE_URL=https://pb-lomaton.epixum.com`.
- `ADMIN_EMAILS=carlosacostap@tecno.unca.edu.ar`.
- `IMPORT_MAX_BYTES=5242880`.
- `IMPORT_MAX_ROWS=5000`.

Secuencia reproducible:

1. Restaurar el último backup productivo en staging.
2. Desplegar PocketBase 0.40.1 con `pocketbase/pb_migrations` y `pocketbase/pb_hooks` montados.
3. Confirmar que la migración se aplicó una sola vez y que `/api/health` responde 200.
4. Configurar Google en la colección `users` de staging.
5. Desplegar Next.js con las variables anteriores y ejecutar `npm run build`, pruebas de login, importación, equipo, cierre administrativo y exportación.
6. Repetir en producción sólo después de que staging y su restauración hayan sido verificados.

Los hooks de prueba bajo `.tools/` crean tokens estáticos y nunca deben copiarse a Dokploy. Solamente se despliega `pocketbase/pb_hooks`.
