import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Refresca la sesión de Supabase en cada request y la deja disponible
 * en las cookies. Devuelve también el usuario, para que el middleware
 * principal pueda proteger rutas como /admin.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Si todavía no se configuró Supabase, dejamos pasar sin sesión
  // (así el sitio arranca igual y muestra el aviso correspondiente).
  if (!url || !key) return { response, user: null, supabase: null };

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Importante: getUser() valida el token contra Supabase (no confiar en getSession()).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, supabase };
}
