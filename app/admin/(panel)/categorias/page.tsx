import type { Metadata } from "next";
import { ListaCategorias } from "@/components/admin/lista-categorias";
import { Titulo } from "@/components/admin/ui";
import { exigirPersonal } from "@/lib/admin";

export const metadata: Metadata = { title: "Categorías" };

export default async function PaginaCategorias() {
  const { sb } = await exigirPersonal();
  const [{ data: categorias, error }, { data: productos }] = await Promise.all([
    sb.from("categories").select("id, name, slug, parent_id, sort_order, active").order("sort_order").order("name"),
    // Solo para contar productos por categoría.
    sb.from("products").select("category_id").not("category_id", "is", null).limit(100000),
  ]);
  if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`);

  const cantidad: Record<string, number> = {};
  for (const p of productos ?? []) if (p.category_id) cantidad[p.category_id] = (cantidad[p.category_id] ?? 0) + 1;

  const todas = categorias ?? [];
  const arbol = todas
    .filter((c) => !c.parent_id)
    .map((c) => ({
      ...c,
      productos: cantidad[c.id] ?? 0,
      hijas: todas.filter((h) => h.parent_id === c.id).map((h) => ({ ...h, productos: cantidad[h.id] ?? 0, hijas: [] })),
    }));

  return (
    <div className="mx-auto max-w-3xl">
      <Titulo>Categorías</Titulo>
      <p className="mb-4 text-sm text-neutral-600">
        Dos niveles: categoría y subcategoría. Las ocultas no se ven en la tienda (sus productos se siguen
        encontrando con el buscador).
      </p>
      <ListaCategorias arbol={arbol} />
    </div>
  );
}
