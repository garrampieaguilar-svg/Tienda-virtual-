# Tienda online del supermercado

Tienda online para un supermercado de barrio: catálogo con buscador, carrito, pedido con retiro o
envío, aviso por WhatsApp, cuentas de cliente opcionales y un panel para atender pedidos y cargar
productos (a mano o importando el archivo del sistema de facturación).

Hecha con **Next.js 14** (App Router), **Supabase** (base de datos, ingreso, archivos y tiempo
real) y **Tailwind CSS**. Pensada primero para el celular.

## Índice

1. [Qué hace](#qué-hace)
2. [Instalación paso a paso](#instalación-paso-a-paso)
3. [Crear el primer administrador](#crear-el-primer-administrador)
4. [Cargar los productos](#cargar-los-productos)
5. [Publicar la tienda en Vercel](#publicar-la-tienda-en-vercel)
6. [Uso diario](#uso-diario)
7. [Ingreso de clientes (emails)](#ingreso-de-clientes-emails)
8. [Base de datos](#base-de-datos)
9. [Cómo está organizado el código](#cómo-está-organizado-el-código)
10. [Seguridad](#seguridad)
11. [Problemas frecuentes](#problemas-frecuentes)

---

## Qué hace

**Para quien compra**

- Catálogo por categorías y subcategorías, ofertas y página de cada producto, con precio por kilo o litro.
- Buscador instantáneo que tolera acentos y errores de tipeo ("galetitas" encuentra "Galletitas").
- Carrito que se guarda en el celular, sin registrarse. Productos por peso se suman de a 250 g, 500 g, etc.
- Checkout en una sola pantalla: datos, retiro o envío (costo fijo o por zona), día y horario, transferencia o efectivo.
- Confirmación con número de pedido, botón para mandarlo por WhatsApp con el mensaje ya escrito,
  datos para transferir (con botón de copiar) y subida del comprobante.
- Cuenta opcional, sin contraseña: datos guardados, historial de pedidos y "Repetir pedido".

**Para el comercio** (`/admin`)

- Pedidos en vivo, con aviso sonoro cuando entra uno nuevo. Cambio de estado (en preparación, listo,
  en camino, entregado, cancelado) y mensaje de WhatsApp listo para avisarle al cliente. Impresión del pedido.
- Productos: buscador, filtros (sin precio, sin stock, sin foto…), edición rápida de precio y stock en la
  misma lista, alta y edición con foto.
- Categorías: crear, renombrar, ordenar, ocultar.
- Importación masiva desde Excel o CSV.
- Configuración (solo administrador): datos del comercio, WhatsApp, cuenta para transferencias,
  compra mínima, envíos, zonas, horarios y control de stock.
- Usuarios (solo administrador): roles de cliente, empleado y administrador.

---

## Instalación paso a paso

Necesitás [Node.js](https://nodejs.org) 18 o más nuevo y una cuenta gratis en [Supabase](https://supabase.com).

### 1. Crear el proyecto en Supabase

1. En [supabase.com/dashboard](https://supabase.com/dashboard) tocá **New project**.
2. Elegí un nombre, una contraseña para la base (guardala) y la región **South America (São Paulo)**.
3. Esperá un par de minutos a que termine de crearse.

### 2. Crear las tablas

En el proyecto, abrí **SQL Editor**, y pegá y ejecutá (**Run**) cada archivo de `supabase/migrations/`,
**uno por vez y en orden**:

```
0001_esquema.sql
0002_funciones.sql
0003_rls.sql
0004_storage.sql
0005_panel.sql
0006_importacion.sql
0007_indices.sql
```

Si Supabase pide confirmar algo (por ejemplo, porque un archivo quita permisos o reemplaza
políticas), confirmalo: es parte de la configuración de seguridad.

**Datos de ejemplo (opcional):** pegá también `supabase/seed.sql`. Carga 56 productos, categorías,
zonas y horarios para probar. Después los podés borrar o reemplazar con la importación.

> Con la CLI de Supabase también funciona: `npx supabase link --project-ref <id>` y `npx supabase db push`.

### 3. Configurar las variables

```bash
npm install
cp .env.example .env.local
```

Completá `.env.local` con los datos de **Project Settings → API Keys** (y la URL de **Data API**):

| Variable                        | Qué va                                                         |
| ------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | La URL del proyecto, `https://xxxx.supabase.co`                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La clave pública (*publishable*, empieza con `sb_publishable_`) |
| `SUPABASE_SERVICE_ROLE_KEY`     | La clave secreta (*secret*). Solo para guardar comprobantes    |
| `NEXT_PUBLIC_SITE_URL`          | `http://localhost:3000` en tu compu; tu dominio en producción  |
| `NEXT_PUBLIC_GOOGLE_LOGIN`      | `true` si activaste el ingreso con Google (ver más abajo)      |

### 4. Probar en tu compu

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

---

## Crear el primer administrador

1. En la tienda, tocá el ícono de la cuenta (arriba a la derecha) e ingresá con tu email.
2. En Supabase → **SQL Editor**, ejecutá (con tu email):

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'tu-email@ejemplo.com');
   ```

3. Entrá a `/admin`. Desde **Usuarios** podés darle acceso a tus empleados: que ingresen una vez a
   la tienda con su email y después les cambiás el rol.

| Rol           | Qué puede hacer                                                            |
| ------------- | -------------------------------------------------------------------------- |
| Cliente       | Comprar y ver sus pedidos                                                  |
| Empleado      | Atender pedidos, cargar y editar productos y categorías, importar          |
| Administrador | Todo lo anterior, más la configuración del comercio y los roles            |

---

## Cargar los productos

**Desde el panel → Importar.** Subí el Excel (`.xlsx`) o CSV que exporta tu sistema de facturación.

- La primera fila tiene que tener los nombres de las columnas. Se reconocen solas
  (`codigo`, `sku`, `ean`, `descripcion`, `rubro`, `precio venta`, `stock`…), y si alguna no, la elegís de una lista.
- Cada producto se identifica por **SKU** (o código de barras si no tiene SKU). Si ya existe se actualiza; si no, se crea.
- Solo cambia lo que trae el archivo: para actualizar precios alcanza con dos columnas, código y precio.
  Destildá "Crear los productos que todavía no existen" para no sumar productos nuevos.
- Se aceptan números con formato argentino (`$ 1.234,50`), CSV separado por `;` o `,`, y archivos
  guardados por Excel en Windows.
- Las categorías que no existan se crean solas. Nada se borra.
- Hay una planilla de ejemplo para descargar en la misma pantalla.

> **Excel y los códigos de barras:** si Excel muestra `7,79E+12`, el código ya se perdió. Antes de
> pegar los códigos, poné esa columna con formato **Texto**.

Las fotos se cargan desde la edición de cada producto. Sin foto se muestra una imagen genérica.

---

## Publicar la tienda en Vercel

1. Subí el código a GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project**, elegí el repositorio.
3. En **Environment Variables** cargá las mismas variables de `.env.local`, con
   `NEXT_PUBLIC_SITE_URL` = la dirección final (por ej. `https://tu-dominio.com`).
4. **Deploy.** Si después conectás un dominio propio, actualizá `NEXT_PUBLIC_SITE_URL` y volvé a publicar.
5. En Supabase → **Authentication → URL Configuration**:
   - *Site URL*: `https://tu-dominio.com`
   - *Redirect URLs*: agregá `https://tu-dominio.com/**`

---

## Uso diario

- **Atender pedidos:** dejá abierto `/admin` en la compu o la tablet del local y tocá **Activar aviso
  con sonido** (el navegador exige un toque para poder sonar). La pestaña muestra cuántos pedidos nuevos hay.
- **Avisarle al cliente:** en cada pedido, después de cambiar el estado, el botón de WhatsApp abre el
  chat con el mensaje listo.
- **Comprobantes:** en el pedido, **Ver comprobante** abre el archivo con un link que vence a los 10 minutos.
- **Cambios en la tienda:** precios, productos, categorías y configuración se ven en la tienda en la
  próxima visita.
- **Cancelar un pedido** devuelve la mercadería al stock si está activado **Controlar stock**.

---

## Ingreso de clientes (emails)

Tener cuenta es opcional. El ingreso es sin contraseña: llega un mail con un código y un link.
Configurá en Supabase → **Authentication**:

1. **URL Configuration:** ver [Publicar la tienda](#publicar-la-tienda-en-vercel).
2. **Emails → Templates → Magic Link** y **Confirm signup** (este llega la primera vez). Reemplazá el
   contenido por algo así, para que traiga el código y un link que funcione aunque el mail se abra en
   otro navegador (pasa mucho en el celular):

   ```html
   <h2>Tu ingreso a la tienda</h2>
   <p>Tu código es: <strong>{{ .Token }}</strong></p>
   <p>O entrá directo: <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Ingresar</a></p>
   ```

3. **Emails → SMTP Settings:** el correo que trae Supabase es solo para pruebas (manda muy pocos mails
   por hora). Para la tienda real conectá un servicio de envío (Resend, Brevo, Amazon SES, etc.).

**Google (opcional):** activalo en *Sign In / Providers → Google* con las credenciales de Google Cloud y
poné `NEXT_PUBLIC_GOOGLE_LOGIN=true`.

---

## Base de datos

| Archivo                   | Qué contiene                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `0001_esquema.sql`        | Tablas, tipos, índices y triggers                                                    |
| `0002_funciones.sql`      | Roles, buscador (`search_products`), creación de pedidos (`create_order`, `get_order`) |
| `0003_rls.sql`            | Permisos y políticas de seguridad por fila (RLS)                                     |
| `0004_storage.sql`        | Archivos: fotos (`products`, público) y comprobantes (`receipts`, privado)           |
| `0005_panel.sql`          | Panel: usuarios, cambio de estado de pedidos e importación masiva                    |
| `0006_importacion.sql`    | Ajustes de la importación                                                            |
| `0007_indices.sql`        | Índices y ajustes de rendimiento                                                     |
| `seed.sql`                | Datos de ejemplo (opcional)                                                          |

Tablas principales: `products`, `categories` (dos niveles), `orders`, `order_items`, `settings`
(una sola fila), `delivery_zones`, `time_slots` y `profiles` (rol y datos de cada usuario).

---

## Cómo está organizado el código

```
app/
  (tienda)/        Tienda pública: inicio, categoría, producto, buscar, ofertas,
                   carrito, checkout, pedido/[id], ingresar, cuenta
  admin/           Panel: login y (panel)/ con pedidos, productos, categorías,
                   importar, configuración y usuarios
  auth/            Vuelta del link del mail y de Google
components/
  tienda/          Piezas de la tienda (tarjeta de producto, buscador, checkout…)
  admin/           Piezas del panel
  ui/              Botones, campos, íconos y demás piezas básicas
lib/
  supabase/        Clientes de Supabase (navegador, servidor, público, admin)
  data/            Consultas del catálogo
  pedido.ts        Reglas de envío, días y horarios, estados
  whatsapp.ts      Mensajes de WhatsApp
  importacion.ts   Lectura y limpieza de archivos para importar
store/carrito.ts   Carrito (se guarda en el navegador)
supabase/          Migraciones y datos de ejemplo
```

| Comando             | Qué hace                       |
| ------------------- | ------------------------------ |
| `npm run dev`       | Servidor de desarrollo         |
| `npm run build`     | Build de producción            |
| `npm run start`     | Sirve el build de producción   |
| `npm run lint`      | Revisa el código               |
| `npm run typecheck` | Revisa los tipos de TypeScript |

---

## Seguridad

- **Los precios los calcula la base.** El navegador solo manda productos y cantidades; `create_order`
  calcula precios, envío, compra mínima, stock y total. Nadie puede pagar menos tocando la página.
- **Permisos en la base (RLS).** Cada cliente ve solo sus pedidos; el personal ve todos; la
  configuración y los roles solo los cambia un administrador. El panel usa la sesión de quien está
  logueado, así que estas reglas valen también ahí.
- **Nadie se da permisos a sí mismo.** Un trigger impide cambiarse el rol; solo un administrador puede.
- **Link secreto del pedido.** Quien compra sin cuenta ve su pedido con un link que lleva un código
  aleatorio imposible de adivinar.
- **Comprobantes privados.** Se guardan en un bucket privado; solo el personal los ve, con links que vencen.
- **La clave secreta** (`SUPABASE_SERVICE_ROLE_KEY`) solo la usa el servidor para guardar comprobantes,
  después de verificar el pedido. Nunca va al navegador.

El *Security Advisor* de Supabase muestra avisos sobre funciones `SECURITY DEFINER` que se pueden
llamar sin sesión (`create_order`, `get_order`, `search_products`, `is_staff`, `is_admin`) y sobre
`admin_users`. Son intencionales: así se puede comprar sin cuenta, y cada función valida lo que hace.

---

## Problemas frecuentes

| Problema | Qué hacer |
| --- | --- |
| "Falta la variable de entorno…" | Revisá `.env.local` (o las variables en Vercel) y reiniciá. |
| El link del mail dice que venció | Se abrió en otro navegador o ya se usó: usá el código del mail, o configurá la plantilla de arriba. |
| No llegan los mails de ingreso | El correo de prueba de Supabase tiene límite: configurá un SMTP propio. |
| No suena el aviso de pedidos | Tocá **Activar aviso con sonido** cada vez que abrís el panel. |
| "No pudimos guardar el comprobante" | Falta `SUPABASE_SERVICE_ROLE_KEY` en el servidor. |
| Un precio cambiado no se ve | La tienda se actualiza en la próxima visita; recargá la página. |
| Las fotos no cargan en producción | `NEXT_PUBLIC_SUPABASE_URL` tiene que estar cargada al momento de publicar (se usa en el build). |
| Una cuenta no puede entrar al panel | Tiene rol de cliente: un administrador tiene que cambiarlo en **Usuarios**. |
