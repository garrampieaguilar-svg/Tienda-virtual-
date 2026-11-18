import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Product } from "@/types/database";

/**
 * Consultas de productos compartidas entre el servidor (primera página)
 * y el navegador (scroll infinito). Reciben el cliente de Supabase a usar.
 */

type Cliente = SupabaseClient<Database>;

/** Columnas que necesita la tarjeta de producto (no traemos descripción ni nada de más). */
export const COLUMNAS_TARJETA =
  "id,name,slug,brand,price,previous_price,on_sale,sale_unit,quantity_step,net_content,net_content_unit,image_url,stock" as const;

export type ProductoTarjeta = Pick<
  Product,
  | "id"
  | "name"
  | "slug"
  | "brand"
  | "price"
  | "previous_price"
  | "on_sale"
  | "sale_unit"
  | "quantity_step"
  | "net_content"
  | "net_content_unit"
  | "image_url"
  | "stock"
>;

export const POR_PAGINA = 24;

/** Qué listado se está mostrando. Es serializable: viaja del servidor al navegador. */
export type ModoListado =
  | { tipo: "categoria"; ids: string[] }
  | { tipo: "ofertas" }
  | { tipo: "buscar"; q: string };

export type PaginaProductos = { productos: ProductoTarjeta[]; hayMas: boolean };

/**
 * Trae una página de productos (la 0 es la primera).
 * Pide uno de más para saber si hay página siguiente sin hacer un COUNT.
 */
export async function traerPagina(
  sb: Cliente,
  modo: ModoListado,
  pagina: number,
): Promise<PaginaProductos> {
  const desde = pagina * POR_PAGINA;
  let filas: ProductoTarjeta[];

  if (modo.tipo === "buscar") {
    const { data, error } = await sb
      .rpc("search_products", { p_query: modo.q, p_limit: POR_PAGINA + 1, p_offset: desde })
      .select(COLUMNAS_TARJETA);
    if (error) throw new Error(error.message);
    filas = (data ?? []) as ProductoTarjeta[];
  } else {
    let consulta = sb.from("products").select(COLUMNAS_TARJETA).eq("active", true);
    if (modo.tipo === "categoria") consulta = consulta.in("category_id", modo.ids);
    if (modo.tipo === "ofertas") consulta = consulta.eq("on_sale", true);

    const { data, error } = await consulta
      .order("name")
      .order("id") // desempate estable: evita repetidos entre páginas
      .range(desde, desde + POR_PAGINA);
    if (error) throw new Error(error.message);
    filas = (data ?? []) as ProductoTarjeta[];
  }

  return { productos: filas.slice(0, POR_PAGINA), hayMas: filas.length > POR_PAGINA };
}
