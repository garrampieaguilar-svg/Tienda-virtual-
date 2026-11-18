import { getCategorias } from "@/lib/data/catalogo";
import { Chips } from "./chips";

/**
 * Chips con las categorías principales (más "Ofertas"), arriba de cada listado.
 * `activa` es el slug de la categoría principal que se está viendo, u "ofertas".
 */
export async function NavCategorias({ activa }: { activa?: string }) {
  const categorias = await getCategorias();
  if (categorias.length === 0) return null;

  return (
    <Chips
      etiqueta="Categorías"
      items={[
        { href: "/ofertas", texto: "Ofertas", activo: activa === "ofertas" },
        ...categorias.map((c) => ({
          href: `/categoria/${c.slug}`,
          texto: c.name,
          activo: activa === c.slug,
        })),
      ]}
    />
  );
}
