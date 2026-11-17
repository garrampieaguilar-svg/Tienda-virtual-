"use server";

import { revalidatePath } from "next/cache";
import { actualizarTienda, casilla, ejecutar, ErrorVisible, exigirPersonal, numero, revisar, texto } from "@/lib/admin";
import { esUuid } from "@/lib/pedido";
import type { ContentUnit, Database, SaleUnit } from "@/types/database";

type CambiosProducto = Database["public"]["Tables"]["products"]["Update"];

const UNIDADES_VENTA: SaleUnit[] = ["unidad", "kilo", "litro", "pack"];
const UNIDADES_CONTENIDO: ContentUnit[] = ["g", "kg", "ml", "l", "un"];

/** Crea (id = null) o actualiza un producto. Devuelve su id. */
export async function guardarProducto(id: string | null, formData: FormData) {
  return ejecutar(async () => {
    const { sb } = await exigirPersonal();
    if (id !== null && !esUuid(id)) throw new ErrorVisible("Datos inválidos.");

    const nombre = texto(formData, "name", 200);
    if (!nombre) throw new ErrorVisible("El producto necesita un nombre.");
    const venta = texto(formData, "sale_unit") as SaleUnit | null;
    if (!venta || !UNIDADES_VENTA.includes(venta)) throw new ErrorVisible("Elegí cómo se vende.");
    const unidadContenido = texto(formData, "net_content_unit") as ContentUnit | null;
    if (unidadContenido && !UNIDADES_CONTENIDO.includes(unidadContenido)) throw new ErrorVisible("Unidad no válida.");
    const categoria = texto(formData, "category_id");
    if (categoria && !esUuid(categoria)) throw new ErrorVisible("Categoría no válida.");
    const paso = numero(formData, "quantity_step", "de a cuánto se vende") ?? 1;
    if (paso <= 0) throw new ErrorVisible("“De a cuánto se suma” tiene que ser mayor que cero.");
    const imagen = texto(formData, "image_url", 1000);
    if (imagen && !/^https:\/\//.test(imagen)) throw new ErrorVisible("La imagen tiene que ser un link https.");

    const datos = {
      name: nombre,
      brand: texto(formData, "brand", 120),
      sku: texto(formData, "sku", 60),
      barcode: texto(formData, "barcode", 60),
      description: texto(formData, "description", 4000),
      category_id: categoria,
      price: numero(formData, "price", "el precio") ?? 0,
      previous_price: numero(formData, "previous_price", "el precio anterior"),
      on_sale: casilla(formData, "on_sale"),
      sale_unit: venta,
      quantity_step: paso,
      net_content: numero(formData, "net_content", "el contenido"),
      net_content_unit: unidadContenido,
      stock: numero(formData, "stock", "el stock") ?? 0,
      active: casilla(formData, "active"),
      image_url: imagen,
    } satisfies CambiosProducto;
    if (datos.net_content && !datos.net_content_unit) {
      throw new ErrorVisible("Elegí la unidad del contenido (g, kg, ml, l o un).");
    }

    const { data, error } = id
      ? await sb.from("products").update(datos).eq("id", id).select("id")
      : await sb.from("products").insert(datos).select("id");
    revisar(error, "No se pudo guardar el producto");
    if (!data?.length) throw new ErrorVisible("No se pudo guardar el producto.");

    actualizarTienda();
    revalidatePath("/admin/productos");
    return data[0].id as string;
  });
}

export async function borrarProducto(id: string) {
  return ejecutar(async () => {
    if (!esUuid(id)) throw new ErrorVisible("Datos inválidos.");
    const { sb } = await exigirPersonal();
    const { data, error } = await sb.from("products").delete().eq("id", id).select("id");
    revisar(error, "No se pudo borrar el producto");
    if (!data?.length) throw new ErrorVisible("No se pudo borrar el producto.");
    actualizarTienda();
    revalidatePath("/admin/productos");
    return null;
  });
}

/** Cambio rápido desde la lista: precio, stock, activo u oferta de un producto. */
export async function cambioRapido(
  id: string,
  campo: "price" | "stock" | "active" | "on_sale",
  valor: number | boolean,
) {
  return ejecutar(async () => {
    if (!esUuid(id)) throw new ErrorVisible("Datos inválidos.");
    if ((campo === "price" || campo === "stock") && (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0)) {
      throw new ErrorVisible("Tiene que ser un número.");
    }
    if ((campo === "active" || campo === "on_sale") && typeof valor !== "boolean") throw new ErrorVisible("Datos inválidos.");
    const { sb } = await exigirPersonal();
    const cambios = { [campo]: valor } as CambiosProducto;
    const { data, error } = await sb.from("products").update(cambios).eq("id", id).select("id");
    revisar(error, "No se pudo guardar");
    if (!data?.length) throw new ErrorVisible("No se pudo guardar.");
    actualizarTienda();
    return null;
  });
}
