import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioIngreso } from "@/components/tienda/formulario-ingreso";
import { rutaSegura } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

type Props = { searchParams: { next?: string; error?: string } };

export default async function PaginaIngresar({ searchParams }: Props) {
  const destino = rutaSegura(searchParams.next);
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (user) redirect(destino);

  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ingresar</h1>
        <p className="text-neutral-600">
          Con tu cuenta ves tus pedidos y no tenés que volver a cargar tus datos. No hace falta
          contraseña.
        </p>
      </header>
      <FormularioIngreso
        destino={destino}
        conGoogle={process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true"}
        errorInicial={
          searchParams.error === "link"
            ? "El link ya se usó o venció. Pedí uno nuevo."
            : undefined
        }
      />
      <p className="text-sm text-neutral-600">
        También podés comprar sin cuenta: armá tu carrito y listo.
      </p>
    </div>
  );
}
