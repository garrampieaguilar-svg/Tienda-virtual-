/** @type {import('next').NextConfig} */

// Dominio del proyecto de Supabase, para permitir que next/image optimice
// las imágenes guardadas en Supabase Storage.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "*.supabase.co";

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
      // Supabase local (supabase start)
      { protocol: "http", hostname: "127.0.0.1", port: "54321" },
    ],
    // Las fotos de producto se ven chicas: no hace falta generar tamaños enormes.
    deviceSizes: [360, 480, 640, 768, 1024, 1280],
    imageSizes: [64, 96, 128, 192, 256],
  },
};

export default nextConfig;
