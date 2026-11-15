import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

/**
 * Cliente con la clave service_role: SALTEA las políticas de RLS.
 *
 * Usalo solo en el servidor y solo para tareas puntuales que lo necesiten
 * (por ejemplo, la importación masiva), siempre después de verificar que
 * quien llama es administrador. Nunca lo importes desde un componente de cliente:
 * el import de "server-only" hace fallar el build si pasa.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
