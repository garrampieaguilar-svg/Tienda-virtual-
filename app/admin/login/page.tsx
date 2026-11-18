import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioIngreso } from "@/components/tienda/formulario-ingreso";
import { sesionPersonal } from "@/lib/admin";
import { rutaSegura } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ingresar al panel", robots: { index: false } };

type Props = { searchParams: { next?: string; error?: string } };

export default async function LoginPanel({ searchParams }: Props) {
  const destino = rutaSegura(searchParams.next, "/admin");
  if (await sesionPersonal()) redirect(destino.startsWith("/admin") ? destino : "/admin");

  const {
    data: { user },
  } = await createClient().auth.getUser();

  return (
    <main className="mx-auto max-w-sm space-y-6 px-4 py-16">
      <header className="space-y-2">
        <p className="text-sm font-medium text-accent">Panel del comercio</p>
        <h1 className="text-2xl font-semibold tracking-tight">Ingresar</h1>
      </header>
      {user ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Ingresaste como <strong className="break-all">{user.email}</strong>, pero esa cuenta no
          tiene acceso al panel. Pedile a un administrador que te dé el rol de empleado.
        </p>
      ) : (
        <FormularioIngreso
          destino={destino.startsWith("/admin") ? destino : "/admin"}
          conGoogle={process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true"}
          errorInicial={
            searchParams.error === "link" ? "El link ya se usó o venció. Pedí uno nuevo." : undefined
          }
        />
      )}
    </main>
  );
}
