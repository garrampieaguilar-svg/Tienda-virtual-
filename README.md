# Tienda online del supermercado

Tienda online minimalista para un supermercado de barrio, hecha con Next.js 14, Supabase y Tailwind CSS.

> 🚧 En construcción, por etapas. Cuando esté completo, este README va a explicar paso a paso la instalación, la configuración de Supabase, la importación de productos, el despliegue en Vercel y cómo crear el primer administrador.

## Arranque rápido (desarrollo)

```bash
npm install
cp .env.example .env.local   # completá las claves de Supabase
npm run dev                  # http://localhost:3000
```

## Cómo se hace un pedido

1. **Carrito** (`/carrito`): vive en el navegador, sin registrarse. Al entrar se vuelven a pedir los precios actuales.
2. **Checkout** (`/checkout`): datos de contacto, retiro o envío, día y horario, y forma de pago.
   El navegador manda solo productos y cantidades; los precios, el envío y el total los calcula la base (`create_order`).
3. **Confirmación** (`/pedido/<id>`): número de pedido, botón para avisar por WhatsApp con el mensaje ya escrito,
   datos para transferir y subida del comprobante. El `id` es un código aleatorio que funciona como link secreto.

> Para que se puedan subir comprobantes hace falta `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`
> (Supabase → Project Settings → API Keys). Sin esa clave el pedido se crea igual y se le pide
> a quien compra que mande el comprobante por WhatsApp.

## Cuentas de cliente

Tener cuenta es opcional: se puede comprar sin registrarse. Con cuenta, el checkout se completa solo
y en `/cuenta` se ven los pedidos anteriores, con un botón para repetirlos.

El ingreso (`/ingresar`) es sin contraseña: llega un mail con un link y un código. Para que funcione
bien en producción hay que configurar tres cosas en Supabase → **Authentication**:

1. **URL Configuration:** en *Site URL* poné la dirección de la tienda (por ej. `https://tu-dominio.com`)
   y agregá `https://tu-dominio.com/**` en *Redirect URLs*.
2. **Emails → Magic Link** (y también **Confirm signup**, que es el que llega la primera vez).
   Reemplazá el contenido por algo así, para que el mail traiga el código y un link que funciona
   aunque se abra en otro navegador (pasa mucho en el celular):

   ```html
   <h2>Tu ingreso a la tienda</h2>
   <p>Tu código es: <strong>{{ .Token }}</strong></p>
   <p>O entrá directo: <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Ingresar</a></p>
   ```

3. **Emails → SMTP Settings:** el correo que trae Supabase es solo para pruebas (manda muy pocos mails
   por hora y solo a los miembros del proyecto). Para la tienda real conectá un servicio de envío propio.

**Google (opcional):** activalo en *Sign In / Providers → Google* con las credenciales de Google Cloud
y después poné `NEXT_PUBLIC_GOOGLE_LOGIN=true` para que aparezca el botón.

## Scripts

| Comando             | Qué hace                         |
| ------------------- | -------------------------------- |
| `npm run dev`       | Servidor de desarrollo           |
| `npm run build`     | Build de producción              |
| `npm run start`     | Sirve el build de producción     |
| `npm run lint`      | Revisa el código con ESLint      |
| `npm run typecheck` | Revisa los tipos de TypeScript   |

## Base de datos

Todo el esquema está en `supabase/migrations/` y se aplica en orden:

| Archivo               | Qué contiene                                                                 |
| --------------------- | ---------------------------------------------------------------------------- |
| `0001_esquema.sql`    | Tablas, tipos, índices y triggers                                            |
| `0002_funciones.sql`  | Roles, buscador (`search_products`), creación de pedidos (`create_order`)    |
| `0003_rls.sql`        | Permisos y políticas de Row Level Security                                   |
| `0004_storage.sql`    | Buckets de imágenes (`products`) y comprobantes (`receipts`)                 |
| `../seed.sql`         | Datos de ejemplo: categorías, 56 productos, zonas y franjas horarias         |

Para aplicarlas, pegá cada archivo (en ese orden) en el **SQL Editor** de Supabase, o usá la CLI:

```bash
npx supabase link --project-ref <id-del-proyecto>
npx supabase db push
# datos de ejemplo (opcional): pegá supabase/seed.sql en el SQL Editor
```
