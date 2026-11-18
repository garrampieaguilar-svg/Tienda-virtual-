"use server";

import { revalidatePath } from "next/cache";
import { actualizarTienda, ejecutar, ErrorVisible, exigirPersonal, revisar } from "@/lib/admin";
import { esUuid } from "@/lib/pedido";
import { slugify } from "@/lib/utils";

function terminar() {
  actualizarTienda();
  revalidatePath("/admin/categorias");
  return null;
}

export async function crearCategoria(nombre: string, padre: string | null) {
  return ejecutar(async () => {
    const limpio = nombre.trim().slice(0, 80);
    if (!limpio) throw new ErrorVisible("Escribí el nombre de la categoría.");
    if (padre !== null && !esUuid(padre)) throw new ErrorVisible("Datos inválidos.");
    const { sb } = await exigirPersonal();

    const { data: hermanas } = await sb
      .from("categories")
      .select("sort_order")
      .filter("parent_id", padre ? "eq" : "is", padre ?? null)
      .order("sort_order", { ascending: false })
      .limit(1);
    let slug = slugify(limpio);
    const { data: repetida } = await sb.from("categories").select("id").eq("slug", slug).maybeSingle();
    if (repetida) slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;

    const { error } = await sb.from("categories").insert({
      name: limpio,
      slug,
      parent_id: padre,
      sort_order: (hermanas?.[0]?.sort_order ?? 0) + 1,
    });
    revisar(error, "No se pudo crear la categoría");
    return terminar();
  });
}

export async function editarCategoria(id: string, cambios: { name?: string; active?: boolean; sort_order?: number }) {
  return ejecutar(async () => {
    if (!esUuid(id)) throw new ErrorVisible("Datos inválidos.");
    const datos: { name?: string; active?: boolean; sort_order?: number } = {};
    if (cambios.name !== undefined) {
      const limpio = cambios.name.trim().slice(0, 80);
      if (!limpio) throw new ErrorVisible("El nombre no puede quedar vacío.");
      datos.name = limpio; // el link (slug) no cambia, así no se rompen los links compartidos
    }
    if (cambios.active !== undefined) datos.active = Boolean(cambios.active);
    if (cambios.sort_order !== undefined) datos.sort_order = Math.trunc(Number(cambios.sort_order)) || 0;
    const { sb } = await exigirPersonal();
    const { data, error } = await sb.from("categories").update(datos).eq("id", id).select("id");
    revisar(error, "No se pudo guardar la categoría");
    if (!data?.length) throw new ErrorVisible("No se pudo guardar la categoría.");
    return terminar();
  });
}

/** Mueve una categoría un lugar arriba o abajo entre sus hermanas. */
export async function moverCategoria(id: string, direccion: "arriba" | "abajo") {
  return ejecutar(async () => {
    if (!esUuid(id)) throw new ErrorVisible("Datos inválidos.");
    const { sb } = await exigirPersonal();
    const { data: actual } = await sb.from("categories").select("id, parent_id").eq("id", id).maybeSingle();
    if (!actual) throw new ErrorVisible("No encontramos la categoría.");
    const { data: hermanas, error } = await sb
      .from("categories")
      .select("id, sort_order, name")
      .filter("parent_id", actual.parent_id ? "eq" : "is", actual.parent_id ?? null)
      .order("sort_order")
      .order("name");
    revisar(error, "No se pudo ordenar");
    const lista = hermanas ?? [];
    const i = lista.findIndex((c) => c.id === id);
    const j = direccion === "arriba" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= lista.length) return null;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    // Renumeramos todas (1, 2, 3…) para que el orden quede prolijo.
    for (const [k, c] of lista.entries()) {
      if (c.sort_order !== k + 1) {
        const { error: e } = await sb.from("categories").update({ sort_order: k + 1 }).eq("id", c.id);
        revisar(e, "No se pudo ordenar");
      }
    }
    return terminar();
  });
}

export async function borrarCategoria(id: string) {
  return ejecutar(async () => {
    if (!esUuid(id)) throw new ErrorVisible("Datos inválidos.");
    const { sb } = await exigirPersonal();
    const { count: hijas } = await sb.from("categories").select("id", { count: "exact", head: true }).eq("parent_id", id);
    if (hijas) throw new ErrorVisible("Tiene subcategorías: borralas o movelas primero.");
    // Los productos de esa categoría quedan "sin categoría" (no se borran).
    const { data, error } = await sb.from("categories").delete().eq("id", id).select("id");
    revisar(error, "No se pudo borrar la categoría");
    if (!data?.length) throw new ErrorVisible("No se pudo borrar la categoría.");
    return terminar();
  });
}
