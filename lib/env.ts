/**
 * Lectura centralizada de variables de entorno, con mensajes de error claros
 * si falta alguna. Las NEXT_PUBLIC_* se leen de forma literal porque Next.js
 * las reemplaza en tiempo de compilación (no sirve process.env[nombre]).
 */

function requerida(valor: string | undefined, nombre: string): string {
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Revisá tu archivo .env.local (podés copiarlo de .env.example).`,
    );
  }
  return valor;
}

export const env = {
  get supabaseUrl() {
    return requerida(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return requerida(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  },
  /** Solo disponible en el servidor. */
  get supabaseServiceRoleKey() {
    return requerida(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");
  },
  get siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  },
};
