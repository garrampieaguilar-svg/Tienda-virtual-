import { NextResponse, type NextRequest } from "next/server";
import { rutaSegura } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";

/**
 * Vuelta del login con Google o del link del email (cuando se abre en el mismo
 * navegador donde se pidió). Supabase manda un código de un solo uso, que acá
 * se cambia por la sesión y se guarda en las cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const codigo = searchParams.get("code");
  const destino = rutaSegura(searchParams.get("next"));

  if (codigo) {
    const { error } = await createClient().auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }
  return NextResponse.redirect(
    `${origin}/ingresar?error=link&next=${encodeURIComponent(destino)}`,
  );
}
