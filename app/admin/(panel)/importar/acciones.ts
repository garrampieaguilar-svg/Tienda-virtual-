"use server";

import { revalidatePath } from "next/cache";
import { actualizarTienda, ejecutar, ErrorVisible, exigirPersonal, revisar } from "@/lib/admin";
import type { ImportResult, ImportRow } from "@/types/database";

/** Máximo de filas por lote (import_products acepta hasta 1000). */
const MAXIMO_LOTE = 500;

/** Importa un lote de filas ya normalizadas en el navegador. */
export async function importarLote(filas: ImportRow[], crearNuevos: boolean) {
  return ejecutar(async (): Promise<ImportResult> => {
    if (!Array.isArray(filas) || filas.length === 0 || filas.length > MAXIMO_LOTE) {
      throw new ErrorVisible("Lote inválido.");
    }
    const { sb } = await exigirPersonal();
    const { data, error } = await sb.rpc("import_products", { p_rows: filas, p_create: Boolean(crearNuevos) });
    revisar(error, "No se pudo importar este lote");
    if (!data) throw new ErrorVisible("No se pudo importar este lote.");
    return data;
  });
}

/** Se llama una vez al terminar: actualiza la tienda y la lista del panel. */
export async function terminarImportacion() {
  return ejecutar(async () => {
    await exigirPersonal();
    actualizarTienda();
    revalidatePath("/admin/productos");
    revalidatePath("/admin/categorias");
    return null;
  });
}
