import type { Metadata } from "next";
import { Footer } from "@/components/tienda/footer";
import { Header } from "@/components/tienda/header";
import { getSettings } from "@/lib/data/catalogo";

/**
 * Layout de la tienda pública: barra superior fija + contenido + pie.
 * El panel de administración (/admin) tiene su propio layout.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { store_name } = await getSettings();
  return {
    title: { default: store_name, template: `%s · ${store_name}` },
    description: `Hacé tu compra en ${store_name} desde el celular y retirala o recibila en tu casa.`,
  };
}

export default async function TiendaLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>
      <Header nombre={settings.store_name} logoUrl={settings.logo_url} />
      <main id="contenido" className="mx-auto w-full max-w-content flex-1 px-4 py-6">
        {children}
      </main>
      <Footer settings={settings} />
    </div>
  );
}
