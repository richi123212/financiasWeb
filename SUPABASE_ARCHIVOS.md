# APK Hub y Drive Personal

Ambos modulos requieren una cuenta e inicio de sesion. Esta decision sustituye el catalogo publico del PDF inicial.

## Lo que debes ejecutar en Supabase

1. Abre tu proyecto en Supabase, entra a **SQL Editor** y pulsa **New query**.
2. Copia TODO el archivo `supabase/migrations/202611020001_apk_hub_drive.sql`.
3. Pegalo en la consulta y pulsa **Run**. Es una transaccion completa; no ejecutes solo fragmentos.
4. Debe terminar con exito. En **Storage** veras `apps-repository` y `personal-drive`, ambos privados.
5. Regresa al portal, inicia sesion y abre **APK Hub** o **Drive Personal**. Si usas la PWA, acepta la nueva version cuando aparezca **Actualizar**.

No se necesita service_role en la pagina ni desplegar una Edge Function. La migracion no modifica los datos ni las tablas de los modulos existentes. Si ya creaste las tablas reducidas del PDF, la comprobacion de estructura puede detener la migracion para no adivinar propietarios ni borrar registros: comparte el error para preparar esa conversion.

## Permisos

- APK Hub: cualquier cuenta del portal puede consultar y descargar las ediciones terminadas, y publicar sus propias aplicaciones. Solo el autor puede eliminar sus cargas o versiones.
- Drive: cada cuenta solo puede ver, subir, descargar o eliminar sus propios archivos.
- Ambos buckets son privados. No existen enlaces publicos permanentes a los APKs. Su descarga usa la sesion de Supabase y un archivo temporal del navegador.
- Drive usa URLs firmadas de una hora para vistas previas y descargas. Esas URLs son credenciales temporales: quien reciba una puede usarla hasta su vencimiento; no son enlaces publicos permanentes.
- El borrado exige escribir el nombre completo, aceptar su caracter permanente y confirmar otra vez. El servidor vuelve a comprobar el propietario; la confirmacion visual no reemplaza los permisos.

## Cargas y versiones

Se reserva primero un registro `uploading` y una ruta unica. TUS envia bloques de 6 MB con progreso y reintentos. Despues de pausar o cerrar la pagina, la fila pendiente permite volver a seleccionar el mismo archivo y reanudarlo. Si el archivo ya termino de subir pero se perdio la confirmacion, se comprueba y finaliza sin volver a subirlo.

Una app se identifica por autor y nombre normalizado. Cada publicacion recibe una edicion consecutiva desde la base de datos, incluso si se borran ediciones anteriores. El campo version es opcional: se puede escribir la version real del APK; si queda vacio se muestra `Edicion N`. Esto no modifica ni extrae el `versionCode` interno del instalador Android.

## Limites de archivos

TUS no evita los limites de tu plan o del bucket. En proyectos Free el limite global no puede superar 50 MB por archivo. Para archivos mayores necesitas un plan/configuracion que los permita. Revisa **Storage > Settings > Global file size limit** y el limite de cada bucket. El SQL conserva los limites existentes; no cambia tu plan ni inicia compras.

Los videos compatibles se reproducen mediante el reproductor del navegador y URLs firmadas; no se realiza conversion de codecs. Otros formatos se descargan para abrirlos en el dispositivo. HTML y SVG no se ejecutan como vista previa del portal.

## Eliminacion y recuperacion

Storage y PostgreSQL no son una transaccion distribuida unica. El flujo es:

1. Marcar el registro `deleting`, comprobando el propietario en el servidor.
2. Eliminar el objeto mediante la API oficial de Storage.
3. Confirmar en PostgreSQL que ya no exista el objeto y retirar los metadatos.

Si cualquiera de los pasos falla, la fila queda pendiente y se puede reintentar. No se muestra exito antes de completar ambos sistemas. Un trigger impide borrar solo los metadatos mientras siga existiendo el objeto. No borres directamente filas de `storage.objects` mediante SQL: eso no elimina el archivo fisico. Las cargas incompletas TUS tambien dependen de la caducidad y limpieza de cargas parciales del proveedor; no se promete una purga atomica instantanea entre dos servicios.

Al eliminar una cuenta, se deben limpiar sus archivos antes: los metadatos usan una referencia restringida para evitar que un borrado en cascada deje objetos sin propietario.

## Validacion realizada

- Compilacion de produccion y pruebas unitarias del proyecto.
- PostgreSQL aislado: migracion repetible, buckets privados, denegacion anonima, aislamiento de Drive, lectura de APKs entre cuentas y bloqueo de borrado/reescritura ajenos incluso con politicas antiguas amplias.
- Navegador movil con SQL real aislado y API de Storage simulada: login obligatorio, carga TUS, pausa y reanudacion de varios bloques, descarga con sesion y confirmacion doble de eliminacion. Un fallo simulado de Storage conserva los metadatos y el reintento termina la limpieza.
- No se ejecuta esta migracion en tu Supabase desde el portal: debes pegar el SQL en su editor antes de usar los nuevos modulos.
