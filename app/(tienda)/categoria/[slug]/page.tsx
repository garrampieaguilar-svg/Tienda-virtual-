import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chips } from "@/components/tienda/chips";
import { ListaInfinita } from "@/components/tienda/lista-infinita";
import { NavCategorias } from "@/components/tienda/nav-categorias";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { getCategoriaPorSlug, getSettings } from "@/lib/data/catalogo";
import { traerPagina, type ModoListado } from "@/lib/data/consultas";
import { createPublicClient } from "@/lib/supabase/publico";
import { cn } from "@/lib/utils";

// Cada página se genera la primera vez que alguien la visita y queda guardada
// en caché; se actualiza como mucho una vez por minuto. (La lista vacía de abajo
// es lo que habilita ese caché para rutas con [slug].)
export const revalidate = 60;
export function generateStaticParams() {
  return [];
}

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const categoria = await getCategoriaPorSlug(params.slug);
  // Si no existe, se muestra la página "No encontramos esta página" (con noindex para buscadores).
  if (!categoria) notFound();
  return { title: categoria.actual.name };
}

export default async function PaginaCategoria({ params }: Props) {
  const categoria = await getCategoriaPorSlug(params.slug);
  if (!categoria) notFound();

  const { actual, principal, ids } = categoria;
  const modo: ModoListado = { tipo: "categoria", ids };
  const [settings, primera] = await Promise.all([
    getSettings(),
    traerPagina(createPublicClient(), modo, 0),
  ]);

  const subcategorias = [
    { href: `/categoria/${principal.slug}`, texto: "Todo", activo: actual.id === principal.id },
    ...principal.hijas.map((h) => ({
      href: `/categoria/${h.slug}`,
      texto: h.name,
      activo: actual.id === h.id,
    })),
  ];

  return (
    <div className="space-y-6">
      <NavCategorias activa={principal.slug} />

      <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-10">
        {/* Escritorio: subcategorías en un menú lateral. */}
        {principal.hijas.length > 0 && (
          <nav aria-label={`Subcategorías de ${principal.name}`} className="hidden lg:block">
            <p className="mb-2 font-semibold text-neutral-900">{principal.name}</p>
            <ul className="space-y-0.5">
              {subcategorias.map((sub) => (
                <li key={sub.href}>
                  <Link
                    href={sub.href}
                    aria-current={sub.activo ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm",
                      sub.activo
                        ? "bg-accent-soft font-medium text-accent"
                        : "text-neutral-700 hover:bg-neutral-100",
                    )}
                  >
                    {sub.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className={cn("space-y-5", principal.hijas.length === 0 && "lg:col-span-2")}>
          <h1 className="text-xl font-semibold tracking-tight">{actual.name}</h1>

          {/* Celular: subcategorías como chips. */}
          {principal.hijas.length > 0 && (
            <div className="lg:hidden">
              <Chips etiqueta={`Subcategorías de ${principal.name}`} items={subcategorias} />
            </div>
          )}

          {primera.productos.length === 0 ? (
            <EstadoVacio
              titulo="Todavía no hay productos acá"
              descripcion="Estamos cargando el catálogo. Mientras tanto, mirá las otras categorías."
            />
          ) : (
            // key: al cambiar de categoría, el listado arranca de cero.
            <ListaInfinita
              key={actual.id}
              modo={modo}
              iniciales={primera.productos}
              hayMasInicial={primera.hayMas}
              controlarStock={settings.track_stock}
            />
          )}
        </div>
      </div>
    </div>
  );
}
