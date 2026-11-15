import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/publico";
import type { Category, Product, Settings } from "@/types/database";
import { COLUMNAS_TARJETA, type ProductoTarjeta } from "./consultas";

/**
 * Lecturas del catálogo desde el servidor.
 * `cache()` evita repetir la misma consulta dentro de un mismo render
 * (por ejemplo, el layout y la página piden las categorías: se consulta una vez).
 */

export const getSettings = cache(async (): Promise<Settings> => {
  const { data, error } = await createPublicClient().from("settings").select("*").eq("id", 1).single();
  if (error) throw new Error(`No se pudo leer la configuración: ${error.message}`);
  return data;
});

export type CategoriaConHijas = Category & { hijas: Category[] };

/** Categorías activas, ya armadas como árbol de dos niveles y ordenadas. */
export const getCategorias = cache(async (): Promise<CategoriaConHijas[]> => {
  const { data, error } = await createPublicClient()
    .from("categories")
    .select("*")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`);

  const todas = data ?? [];
  return todas
    .filter((c) => !c.parent_id)
    .map((c) => ({ ...c, hijas: todas.filter((h) => h.parent_id === c.id) }));
});

export type CategoriaEncontrada = {
  /** La categoría de la URL (puede ser principal o subcategoría). */
  actual: Category;
  /** La categoría principal a la que pertenece (ella misma si ya es principal). */
  principal: CategoriaConHijas;
  /** Ids de categorías cuyos productos hay que listar. */
  ids: string[];
};

export async function getCategoriaPorSlug(slug: string): Promise<CategoriaEncontrada | null> {
  const categorias = await getCategorias();
  for (const principal of categorias) {
    if (principal.slug === slug) {
      return { actual: principal, principal, ids: [principal.id, ...principal.hijas.map((h) => h.id)] };
    }
    const hija = principal.hijas.find((h) => h.slug === slug);
    if (hija) return { actual: hija, principal, ids: [hija.id] };
  }
  return null;
}

export const getProductoPorSlug = cache(async (slug: string): Promise<Product | null> => {
  const { data, error } = await createPublicClient()
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el producto: ${error.message}`);
  return data;
});

/** Otros productos de la misma categoría, para "También te puede interesar". */
export async function getRelacionados(producto: Product, cantidad = 6): Promise<ProductoTarjeta[]> {
  if (!producto.category_id) return [];
  const { data, error } = await createPublicClient()
    .from("products")
    .select(COLUMNAS_TARJETA)
    .eq("active", true)
    .eq("category_id", producto.category_id)
    .neq("id", producto.id)
    .order("on_sale", { ascending: false })
    .order("name")
    .limit(cantidad);
  if (error) return []; // los relacionados no son críticos: si fallan, no se muestran
  return (data ?? []) as ProductoTarjeta[];
}
