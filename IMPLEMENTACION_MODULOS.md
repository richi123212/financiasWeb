# Notas y Reserva & Ahorros

El proyecto usa React 19, TypeScript, Vite, Tailwind y Supabase Auth/Postgres. La navegación es por estado en App.tsx; no requiere nuevas rutas ni servidor separado en Vercel.

## Archivos

- `src/components/NotesTracker.tsx`: carpetas con color/ícono, notas, etiquetas, búsqueda, fijado y editor con vista previa de Markdown ligero (#, ##, listas).
- `src/components/CajitasTracker.tsx`: apartados, metas, movimientos, historial y resumen de saldo protegido/disponible.
- `src/hooks/useModuleData.ts`: carga remota, errores, refresco al enfocar la ventana y persistencia demo aislada por usuario.
- `src/lib/notesData.ts` y `src/lib/cajitasData.ts`: servicios Supabase. Se completaron los servicios que ya estaban en el directorio de trabajo.
- `src/App.tsx`, `src/components/ModuleHub.tsx`, `src/components/Navbar.tsx`, `src/types/index.ts`, `src/utils/financeCalculators.ts`: integración y cálculos.
- `supabase/migrations/202610280001_notes_reserves.sql`: tablas, índices, RLS por usuario, validación de carpeta y movimiento atómico mediante RPC.
- `tests/reserves.test.mjs`: pruebas de separación, liberación, déficit, precisión y proyección quincenal.

## Modelo financiero

El saldo total sigue siendo **Dinero Actual Digital** declarado en Finanzas (no es una sincronización bancaria). Debe incluir los importes que vas a clasificar como reserva; no agregues de nuevo la reserva a ese total.

```
Disponible Real para Gastos = Dinero Actual Digital − suma de cajitas
Margen para compras = Disponible Real − deuda TDC − cuotas MSI − gastos fijos pendientes
```

Ejemplo: saldo total $10,000, reservas $4,000, deuda $1,000 y gastos fijos $500: disponible $6,000; margen para compras $4,500. Apartar $500 reduce el disponible a $5,500. Liberar $200 lo sube a $5,700. El saldo total sigue siendo $10,000.

Cada cajita empieza en cero; registra su saldo mediante **Apartar dinero**. No se permite liberar más del saldo ni eliminar un apartado con saldo. Para eliminarlo, libera primero su dinero. Su historial se elimina con el apartado; para conservarlo, deja el apartado en cero sin eliminarlo.

`institution` etiqueta los apartados. El portal actual tiene un único saldo declarado global, no un libro de saldos por institución: el resumen es global. Solo aparta dinero ya incluido en ese saldo; si Cetes se contabiliza exclusivamente como inversión separada, no lo vuelvas a descontar de un saldo bancario que no lo incluye. El módulo Riqueza conserva su bóveda independiente; no se copia automáticamente a cajitas.

La RPC bloquea la fila y registra saldo/movimiento en una transacción. Identifica al propietario con `auth.uid()` y rechaza sobregiros del apartado; la comprobación de disponible global usa el saldo declarado en el frontend, igual que los cálculos actuales. No hay una garantía contable de fondos bancarios ni de asignación global entre distintas sesiones concurrentes. Al volver a la ventana se refrescan las reservas.

Si las reservas no cargan, Finanzas, Compras y Cajitas muestran un error/reintento en lugar de presentar un saldo disponible sin el descuento. Los demás módulos continúan funcionando.

## 1. Supabase: aplicar primero la migración

Este repositorio tiene un esquema SQL manual y no contiene una configuración previa del CLI Supabase. En el proyecto correcto de Supabase, abre **SQL Editor → New query**, pega el contenido completo de:

`supabase/migrations/202610280001_notes_reserves.sql`

y ejecútalo. Es una transacción; no borra ni modifica registros de los módulos financieros existentes. No vuelvas a ejecutar todo `supabase_schema.sql` para esta actualización. Conserva este archivo versionado como registro de la migración aplicada. Si después adoptas Supabase CLI, alinea primero el historial remoto con esta aplicación manual antes de usar `db push`.

Comprueba en SQL Editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
and tablename in ('notes', 'note_folders', 'cajitas_apartados', 'cajitas_movimientos');
-- Las cuatro filas deben mostrar rowsecurity = true.
```

## 2. Validar localmente (PowerShell)

```powershell
Set-Location C:\PaginaWebfinancieraPersonal
npm ci
npm test
npm run build
npm run lint
npm run dev
```

Usa Node 24 o una versión compatible con la ejecución nativa de TypeScript del comando de pruebas. Configura `.env` usando `.env.example` si necesitas apuntar a otro proyecto. Entra con una cuenta real para probar la persistencia de Supabase. El modo demo almacena notas/cajitas localmente; el historial demo dura la sesión del módulo y no se sube a Supabase.

Prueba también con dos cuentas: cada una debe ver solo sus notas, carpetas, apartados e historial. Crea una nota en una carpeta, elimínala y comprueba que la nota pase a Sin clasificar. Aparta dinero, recarga, libera una parte y confirma que el disponible y la proyección cambien sin alterar el saldo total. Intenta liberar más del saldo y eliminar un apartado con fondos: ambas operaciones deben rechazarse.

## 3. Vercel

En **Settings → Environment Variables**, verifica las variables para Production y Preview según corresponda:

```
VITE_SUPABASE_URL=<URL del proyecto>
VITE_SUPABASE_ANON_KEY=<publishable key o anon key pública>
```

No uses una clave `service_role` en el frontend. Vite expone las variables `VITE_*` al navegador; la protección de datos depende de RLS. El cliente existente también tiene valores públicos de respaldo: las variables explícitas permiten seleccionar el proyecto de despliegue correcto.

Configuración esperada: framework **Vite**, build `npm run build`, output `dist`. `vercel.json` ya contiene el rewrite a `index.html`. No necesitas cambiarlo ni configurar un backend nuevo.

## 4. Subir a Git y desplegar

La revisión local encontró la rama `main` y el remoto `origin` apuntando a `richi123212/financiasWeb`. Revisa el diff antes del commit: los tipos y servicios iniciales ya tenían cambios locales cuando empezó esta implementación.

```powershell
git diff
git status --short
git add src/App.tsx src/components/ModuleHub.tsx src/components/Navbar.tsx src/components/NotesTracker.tsx src/components/CajitasTracker.tsx src/hooks/useModuleData.ts src/lib/notesData.ts src/lib/cajitasData.ts src/types/index.ts src/utils/financeCalculators.ts supabase/migrations/202610280001_notes_reserves.sql tests/reserves.test.mjs package.json IMPLEMENTACION_MODULOS.md
git commit -m "Agrega notas y carpetas y modulo de reservas y ahorros"
git push origin main
```

Si Vercel tiene este repositorio conectado y `main` es su Production Branch, el push inicia el despliegue. Comprueba el estado en Deployments y repite las pruebas con sesión real. Los cambios en variables de entorno requieren un despliegue nuevo.

No se ejecutó la migración remota ni se hizo commit, push o despliegue desde esta implementación. Las pruebas automáticas de cálculo no sustituyen la prueba de RLS y RPC en tu instancia real de Supabase.

Validación local realizada: cinco pruebas aprobadas, compilación TypeScript/Vite correcta y lint sin errores. Los archivos nuevos pasan lint sin advertencias; el lint general conserva advertencias de componentes existentes y Vite advierte sobre el tamaño del bundle. La verificación visual automatizada quedó pendiente porque el navegador de herramientas no pudo iniciar por un error del entorno de seguridad de Windows.

Documentación oficial: https://vercel.com/docs/frameworks/frontend/vite · https://vercel.com/docs/git · https://supabase.com/docs/guides/database/postgres/row-level-security · https://supabase.com/docs/guides/deployment/database-migrations
