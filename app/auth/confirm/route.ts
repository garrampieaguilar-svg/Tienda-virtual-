import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { rutaSegura } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";

/**
 * Link del email con "token_hash". A diferencia de /auth/callback, funciona
 * aunque el mail se abra en otro navegador (muy común en el celular: la app de
 * correo abre su propio navegador). Para usarlo hay que cambiar la plantilla
 * del email en Supabase; el README explica cómo.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const destino = rutaSegura(searchParams.get("next"));

  if (tokenHash && tipo) {
    const { error } = await createClient().auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }
  return NextResponse.redirect(
    `${origin}/ingresar?error=link&next=${encodeURIComponent(destino)}`,
  );
}
