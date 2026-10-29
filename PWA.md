# Instalación y uso sin conexión

No se duplica el proyecto ni Supabase. La misma web de Vercel se puede instalar como PWA.

1. Abrir la página en Chrome para Android, con internet.
2. Iniciar sesión con la cuenta habitual y abrir GYM. Esperar a que indique «Historial sincronizado».
3. Pulsar «Instalar» en la franja superior o usar el menú de Chrome → Instalar aplicación / Agregar a pantalla principal.
4. Abrirla desde el nuevo icono. El gimnasio permite consultar el historial descargado, continuar borradores y finalizar entrenamientos sin señal.
5. Al volver internet, abrir o mantener abierta la app para enviar los cambios pendientes. Confirmar que el indicador vuelva a «Historial sincronizado».

En iPhone se usa Safari → Compartir → Agregar a inicio. La disponibilidad exacta de instalación depende del navegador.

## Alcance

- El primer acceso e inicio de sesión requieren internet. No hay inicio de sesión nuevo sin conexión.
- El modo sin conexión completo corresponde al gimnasio; el resto de módulos requiere conexión.
- Los borradores activos solo están en el dispositivo donde se crean; finalizar el entrenamiento lo incorpora a la cola de respaldo.
- No se promete sincronización mientras la aplicación permanece cerrada. Se reintenta al recuperar conexión, regresar a la app y periódicamente mientras está abierta.
- Los datos pendientes no deben borrarse del almacenamiento del navegador ni desinstalarse antes de sincronizarlos.
- Las actualizaciones se anuncian con «Actualizar». No se recarga automáticamente durante un entrenamiento.
- No requiere ejecutar SQL nuevo.

## Persistencia y compatibilidad

IndexedDB `finanzshield-offline`, almacén `gym`, guarda por usuario el historial, las operaciones pendientes y la última sincronización. La escritura de un entrenamiento y su operación pendiente ocurre en una única transacción. Los UUID se asignan antes de enviar y los reintentos usan el mismo ID con `ON CONFLICT DO NOTHING`, seguido de una lectura del registro para confirmar el respaldo.

Las eliminaciones se conservan como operaciones pendientes para no resucitar registros al reconectar. La unión con la nube aplica primero esos cambios pendientes; un registro previamente sincronizado y borrado en otro dispositivo no se vuelve a insertar desde una caché antigua. Las operaciones de red entre pestañas se serializan con Web Locks cuando está disponible.

Los datos anteriores de `finanzshield_gym_<usuario>` se importan una vez y el original permanece intacto. Solo los IDs antiguos `local-...` se consideran pendientes de subir; las filas que ya tienen UUID no se vuelven a insertar por faltar en una respuesta remota. Los borradores conservan su clave anterior.

El service worker almacena exclusivamente HTML, JS, CSS, manifiesto e iconos del mismo origen. No intercepta ni guarda respuestas de Supabase, autenticación o APIs. Su caché depende del contenido de cada compilación y mantiene el HTML y sus archivos de la misma versión hasta aceptar la actualización.

## Verificación

- `npm test`: migración sin modificar originales, aislamiento por usuario, cola con IDs estables, mezcla con la nube y eliminaciones pendientes, además de las pruebas existentes.
- `npm run build` y `npm run lint`.
- Pruebas de navegador sobre `npm run preview`: manifiesto e iconos válidos, instalación en Chrome normal, arranque sin conexión, borrador tras recargar, finalización offline, respuesta de servidor perdida, reintento sin duplicados, recuperación desde navegador limpio y eliminación offline. Los escenarios de pérdida de red usan un backend simulado aislado.
