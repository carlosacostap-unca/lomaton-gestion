## 1. Contrato de rechazo

- [x] 1.1 Leer la guía local de Next.js pertinente para rutas y componentes cliente antes de editar, y verificar que las APIs elegidas coincidan con la versión instalada.
- [x] 1.2 Definir el mensaje público de cuenta no registrada y asociarlo al código estable `email_not_authorized`; verificar con una prueba unitaria que el bootstrap responde 403 con ese código y el texto acordado para una identidad ajena al padrón y a la lista administrativa.
- [x] 1.3 Preservar los comportamientos diferenciados para email no verificado y errores inesperados; verificar que sus pruebas no los presenten como una cuenta no registrada.

## 2. Propagación y presentación en el cliente

- [x] 2.1 Interpretar la respuesta estructurada del bootstrap en el proveedor de autenticación, limpiar usuario, rol y credenciales locales ante el rechazo, y conservar el mensaje público tanto después del OAuth como durante la revalidación inicial; verificar ambos recorridos con pruebas del proveedor.
- [x] 2.2 Exponer acciones para limpiar el rechazo al reintentar o cerrar sesión y mostrarlo en la pantalla de acceso mediante un aviso con `role="alert"`; verificar con una prueba de componente que el texto aparece completo y desaparece al iniciar un nuevo intento.
- [x] 2.3 Mantener el aviso genérico para cancelaciones de Google, fallas de red y respuestas no reconocidas; verificar mediante pruebas de interfaz que esos casos no afirman que la cuenta está fuera del padrón.

## 3. Verificación integral

- [x] 3.1 Ejecutar `npm test` y comprobar que pasan las pruebas nuevas y las existentes de política, bootstrap y autenticación.
- [x] 3.2 Ejecutar `npm run lint`, `npm run typecheck` y `npm run build`, y corregir cualquier regresión relacionada con el cambio.
- [x] 3.3 Ejecutar `npx openspec validate explicar-acceso-no-registrado --strict` y confirmar que la propuesta, la especificación, el diseño y las tareas son coherentes.
