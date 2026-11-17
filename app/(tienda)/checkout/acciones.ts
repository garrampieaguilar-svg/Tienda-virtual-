"use server";

import { COMPROBANTE_MAX_BYTES, COMPROBANTE_TIPOS, esUuid } from "@/lib/pedido";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CreateOrderInput, CreateOrderItem } from "@/types/database";

/**
 * Acciones del checkout. Corren en el servidor.
 *
 * Los precios y totales NO vienen del navegador: create_order() los calcula
 * en la base con los precios actuales. De acá solo salen productos y cantidades.
 */

export type ResultadoPedido =
  | {
      ok: true;
      id: string;
      /** Si se adjuntó un comprobante y no se pudo guardar, el motivo (el pedido igual quedó hecho). */
      errorComprobante?: string;
    }
  | { ok: false; error: string };

export type ResultadoComprobante = { ok: true } | { ok: false; error: string };

const ERROR_GENERICO = "No pudimos registrar tu pedido. Probá de nuevo en un momento.";

function leerJson<T>(valor: FormDataEntryValue | null): T | null {
  if (typeof valor !== "string") return null;
  try {
    return JSON.parse(valor) as T;
  } catch {
    return null;
  }
}

/** Devuelve el archivo adjunto, o null si no se adjuntó nada. */
function leerArchivo(valor: FormDataEntryValue | null): File | null {
  return valor instanceof File && valor.size > 0 ? valor : null;
}

/**
 * Crea el pedido. Recibe un FormData con:
 *   - pedido: JSON con los datos del formulario (CreateOrderInput)
 *   - items: JSON con [{ product_id, quantity }]
 *   - comprobante: archivo opcional (solo si paga por transferencia)
 */
export async function crearPedido(formData: FormData): Promise<ResultadoPedido> {
  const pedido = leerJson<CreateOrderInput>(formData.get("pedido"));
  const items = leerJson<CreateOrderItem[]>(formData.get("items"));
  if (!pedido || !Array.isArray(items)) return { ok: false, error: ERROR_GENERICO };

  // Con el cliente de servidor: si quien compra tiene sesión, el pedido queda a su nombre.
  const sb = createClient();
  const { data, error } = await sb.rpc("create_order", {
    p_order: pedido,
    p_items: items,
  });

  if (error || !data) {
    // P0001 = "raise exception" de la función: son mensajes pensados para mostrarle a quien compra.
    if (error?.code === "P0001") return { ok: false, error: error.message };
    console.error("create_order falló:", error);
    return { ok: false, error: ERROR_GENERICO };
  }

  await completarPerfil(sb, pedido);

  const archivo = leerArchivo(formData.get("comprobante"));
  if (archivo && pedido.payment_method === "transfer") {
    const resultado = await guardarComprobante(data.id, archivo);
    if (!resultado.ok) return { ok: true, id: data.id, errorComprobante: resultado.error };
  }

  return { ok: true, id: data.id };
}

/**
 * Si quien compró tiene cuenta, guarda en su perfil los datos que todavía no
 * tenía cargados (no pisa nada). Si falla no importa: el pedido ya está hecho.
 */
async function completarPerfil(sb: ReturnType<typeof createClient>, pedido: CreateOrderInput) {
  try {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return;
    const { data: perfil } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (!perfil) return;

    const cambios = {
      ...(!perfil.full_name && { full_name: pedido.customer_name }),
      ...(!perfil.phone && { phone: pedido.customer_phone }),
      ...(!perfil.address && pedido.address && { address: pedido.address }),
      ...(!perfil.address_notes && pedido.address_notes && { address_notes: pedido.address_notes }),
    };
    if (Object.keys(cambios).length > 0) {
      await sb.from("profiles").update(cambios).eq("id", user.id);
    }
  } catch (e) {
    console.error("No se pudo completar el perfil:", e);
  }
}

/** Sube (o reemplaza) el comprobante de un pedido ya hecho, desde la pantalla de confirmación. */
export async function subirComprobante(formData: FormData): Promise<ResultadoComprobante> {
  const id = formData.get("pedido_id");
  const archivo = leerArchivo(formData.get("comprobante"));
  if (typeof id !== "string" || !esUuid(id)) {
    return { ok: false, error: "No encontramos el pedido." };
  }
  if (!archivo) return { ok: false, error: "Elegí el archivo del comprobante." };
  return guardarComprobante(id, archivo);
}

/**
 * Guarda el comprobante en el bucket privado "receipts" y anota la ruta en el pedido.
 *
 * Usa la clave service_role porque el bucket no acepta subidas desde el navegador:
 * así solo entran archivos que pasaron por estos controles y que pertenecen a un
 * pedido real pagado por transferencia.
 */
async function guardarComprobante(pedidoId: string, archivo: File): Promise<ResultadoComprobante> {
  const extension = COMPROBANTE_TIPOS[archivo.type];
  if (!extension) {
    return { ok: false, error: "El comprobante tiene que ser una foto (JPG, PNG, WebP) o un PDF." };
  }
  if (archivo.size > COMPROBANTE_MAX_BYTES) {
    return { ok: false, error: "El archivo es muy pesado: el máximo es 10 MB." };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Falta SUPABASE_SERVICE_ROLE_KEY: no se pueden guardar comprobantes.");
    return {
      ok: false,
      error: "No pudimos guardar el comprobante. Mandanoslo por WhatsApp.",
    };
  }

  const admin = createAdminClient();
  const { data: pedido, error: errorPedido } = await admin
    .from("orders")
    .select("id, status, payment_method, receipt_path")
    .eq("id", pedidoId)
    .maybeSingle();

  if (errorPedido) {
    console.error("No se pudo leer el pedido para el comprobante:", errorPedido);
    return { ok: false, error: "No pudimos guardar el comprobante. Probá de nuevo." };
  }
  if (!pedido) return { ok: false, error: "No encontramos el pedido." };
  if (pedido.payment_method !== "transfer") {
    return { ok: false, error: "Este pedido no se paga por transferencia." };
  }
  if (pedido.status === "delivered" || pedido.status === "cancelled") {
    return { ok: false, error: "Este pedido ya está cerrado." };
  }

  // El nombre lo armamos nosotros: nunca se usa el nombre original del archivo.
  const ruta = `${pedidoId}/comprobante-${Date.now()}.${extension}`;
  const { error: errorSubida } = await admin.storage
    .from("receipts")
    .upload(ruta, archivo, { contentType: archivo.type });
  if (errorSubida) {
    console.error("No se pudo subir el comprobante:", errorSubida);
    return { ok: false, error: "No pudimos guardar el comprobante. Probá de nuevo." };
  }

  const { error: errorUpdate } = await admin
    .from("orders")
    .update({ receipt_path: ruta })
    .eq("id", pedidoId);
  if (errorUpdate) {
    console.error("No se pudo anotar el comprobante en el pedido:", errorUpdate);
    await admin.storage.from("receipts").remove([ruta]);
    return { ok: false, error: "No pudimos guardar el comprobante. Probá de nuevo." };
  }

  // Si reemplazó uno anterior, el viejo ya no hace falta.
  if (pedido.receipt_path) await admin.storage.from("receipts").remove([pedido.receipt_path]);

  return { ok: true };
}
