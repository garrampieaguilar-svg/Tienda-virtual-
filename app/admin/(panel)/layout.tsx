import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NavPanel } from "@/components/admin/nav-panel";
import { cerrarSesion } from "@/app/(tienda)/cuenta/acciones";
import { sesionPersonal } from "@/lib/admin";
import { getSettings } from "@/lib/data/catalogo";

// El panel siempre muestra datos al día: nada de caché.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel" },
  robots: { index: false, follow: false },
};

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const sesion = await sesionPersonal();
  // Sin sesión, o con una sesión que no es del personal: al login del panel
  // (que le explica a quien no tiene permiso por qué no puede entrar).
  if (!sesion) redirect("/admin/login");
  const settings = await getSettings();

  return (
    <div className="min-h-dvh bg-neutral-50 print:bg-white">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <p className="min-w-0 truncate font-semibold">{settings.store_name}</p>
          <span className="hidden rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 sm:inline">
            {sesion.rol === "admin" ? "Administrador" : "Empleado"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <a href="/" target="_blank" className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
              Ver tienda
            </a>
            <form action={cerrarSesion}>
              <button type="submit" className="rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
                Salir
              </button>
            </form>
          </div>
        </div>
        <NavPanel esAdmin={sesion.rol === "admin"} />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
