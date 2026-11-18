"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconoUsuario } from "@/components/ui/iconos";
import { createClient } from "@/lib/supabase/client";

/**
 * Ícono de la cuenta en la barra superior.
 * Averigua en el navegador si hay sesión (no en el servidor), para que las
 * páginas del catálogo se puedan seguir sirviendo desde el caché.
 */
export function BotonCuenta() {
  const [conSesion, setConSesion] = useState(false);

  useEffect(() => {
    const { auth } = createClient();
    auth.getSession().then(({ data }) => setConSesion(Boolean(data.session)));
    const { data } = auth.onAuthStateChange((_evento, sesion) => setConSesion(Boolean(sesion)));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <Link
      href={conSesion ? "/cuenta" : "/ingresar"}
      aria-label={conSesion ? "Mi cuenta" : "Ingresar"}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-800 hover:bg-neutral-100"
    >
      <IconoUsuario />
      {conSesion && (
        <span aria-hidden className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-accent" />
      )}
    </Link>
  );
}
