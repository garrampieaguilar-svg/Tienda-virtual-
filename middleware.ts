import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware global:
 * 1. Mantiene viva la sesión de Supabase.
 * 2. Protege /admin: sin sesión, redirige al login del panel.
 *    (La verificación del ROL —admin o empleado— se hace en el layout del
 *    panel y, sobre todo, en la base de datos con RLS.)
 */
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const esAdmin = pathname.startsWith("/admin");
  const esLoginAdmin = pathname === "/admin/login";

  if (esAdmin && !esLoginAdmin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Corre en todas las rutas salvo archivos estáticos e imágenes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
