import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware global: mantiene viva la sesión de Supabase (refresca el token y
 * lo guarda en las cookies).
 *
 * No decide quién entra a dónde: eso lo hace cada sección en el servidor
 * (/cuenta en su página, /admin en su layout, que además verifica el rol).
 * Así hay un solo lugar que decide, y no pueden armarse idas y vueltas entre
 * el middleware y las páginas.
 */
export async function middleware(request: NextRequest) {
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  // Corre en todas las rutas salvo archivos estáticos e imágenes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
