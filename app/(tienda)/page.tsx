import Link from "next/link";
import { NavCategorias } from "@/components/tienda/nav-categorias";
import { GrillaProductos, TarjetaProducto } from "@/components/tienda/tarjeta-producto";
import { IconoFlecha } from "@/components/ui/iconos";
import { getCategorias, getSettings } from "@/lib/data/catalogo";
import { traerPagina } from "@/lib/data/consultas";
import { createPublicClient } from "@/lib/supabase/publico";

// La home se guarda en caché y se regenera como mucho una vez por minuto.
export const revalidate = 60;

const OFERTAS_EN_HOME = 10;

export default async function Home() {
  const [settings, categorias, ofertas] = await Promise.all([
    getSettings(),
    getCategorias(),
    traerPagina(createPublicClient(), { tipo: "ofertas" }, 0),
  ]);
  const destacadas = ofertas.productos.slice(0, OFERTAS_EN_HOME);
  const hayMasOfertas = ofertas.hayMas || ofertas.productos.length > OFERTAS_EN_HOME;

  return (
    <div className="space-y-12">
      <NavCategorias />

      {destacadas.length > 0 && (
        <section aria-labelledby="titulo-ofertas" className="space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <h1 id="titulo-ofertas" className="text-xl font-semibold tracking-tight">
              Ofertas
            </h1>
            {hayMasOfertas && (
              <Link href="/ofertas" className="rounded text-sm font-medium text-accent underline-offset-2 hover:underline">
                Ver todas
              </Link>
            )}
          </div>
          <GrillaProductos>
            {destacadas.map((producto) => (
              <li key={producto.id}>
                <TarjetaProducto producto={producto} controlarStock={settings.track_stock} />
              </li>
            ))}
          </GrillaProductos>
        </section>
      )}

      <section aria-labelledby="titulo-categorias" className="space-y-5">
        <h2 id="titulo-categorias" className="text-xl font-semibold tracking-tight">
          Categorías
        </h2>
        {categorias.length === 0 ? (
          <p className="text-neutral-600">Todavía no hay categorías cargadas.</p>
        ) : (
          <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {categorias.map((categoria) => (
              <li key={categoria.id} className="space-y-2">
                <Link
                  href={`/categoria/${categoria.slug}`}
                  className="group flex items-center justify-between rounded border-b border-neutral-200 pb-2 font-medium text-neutral-900"
                >
                  <span className="group-hover:underline">{categoria.name}</span>
                  <IconoFlecha width={18} height={18} className="text-neutral-400" />
                </Link>
                {categoria.hijas.length > 0 && (
                  <ul className="space-y-0.5">
                    {categoria.hijas.map((hija) => (
                      <li key={hija.id}>
                        <Link
                          href={`/categoria/${hija.slug}`}
                          className="inline-block rounded py-1.5 text-sm text-neutral-600 hover:text-neutral-900 hover:underline"
                        >
                          {hija.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
