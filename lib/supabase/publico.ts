import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

/**
 * Cliente de Supabase SIN sesión, para leer el catálogo público desde el servidor.
 *
 * Al no usar cookies, las páginas del catálogo se pueden guardar en caché
 * (ver `revalidate` en cada página) y se sirven rapidísimo aunque haya miles
 * de productos. Para todo lo que dependa del usuario, usar lib/supabase/server.ts.
 */
export function createPublicClient() {
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
