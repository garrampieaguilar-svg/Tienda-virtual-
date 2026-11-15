# Tienda online del supermercado

Tienda online minimalista para un supermercado de barrio, hecha con Next.js 14, Supabase y Tailwind CSS.

> 🚧 En construcción, por etapas. Cuando esté completo, este README va a explicar paso a paso la instalación, la configuración de Supabase, la importación de productos, el despliegue en Vercel y cómo crear el primer administrador.

## Arranque rápido (desarrollo)

```bash
npm install
cp .env.example .env.local   # completá las claves de Supabase
npm run dev                  # http://localhost:3000
```

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
