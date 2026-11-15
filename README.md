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
