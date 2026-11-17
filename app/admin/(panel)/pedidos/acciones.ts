"use server";

import { revalidatePath } from "next/cache";
import { ejecutar, exigirAdmin, exigirPersonal, ErrorVisible, revisar } from "@/lib/admin";
import { esUuid } from "@/lib/pedido";
import type { OrderStatus } from "@/types/database";

const ESTADOS: OrderStatus[] = ["new", "preparing", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"];

export async function cambiarEstado(id: string, estado: OrderStatus) {
  return ejecutar(async () => {
    if (!esUuid(id) || !ESTADOS.includes(estado)) throw new ErrorVisible("Datos inválidos.");
    const { sb } = await exigirPersonal();
    const { error } = await sb.rpc("set_order_status", { p_order_id: id, p_status: estado });
    revisar(error, "No se pudo cambiar el estado");
    revalidatePath("/admin");
    revalidatePath(`/admin/pedidos/${id}`);
    return null;
  });
}

/** Link temporal (10 minutos) para ver el comprobante, que está en un bucket privado. */
export async function verComprobante(id: string) {
  return ejecutar(async () => {
    if (!esUuid(id)) throw new ErrorVisible("Datos inválidos.");
    const { sb } = await exigirPersonal();
    const { data: pedido, error } = await sb.from("orders").select("receipt_path").eq("id", id).maybeSingle();
    revisar(error, "No se pudo leer el pedido");
    if (!pedido?.receipt_path) throw new ErrorVisible("Este pedido no tiene comprobante.");
    const { data, error: errorLink } = await sb.storage.from("receipts").createSignedUrl(pedido.receipt_path, 600);
    if (errorLink || !data) throw new ErrorVisible("No se pudo abrir el comprobante.");
    return data.signedUrl;
  });
}

/** Borra un pedido para siempre (solo admin). Para el día a día conviene cancelarlo. */
export async function borrarPedido(id: string) {
  return ejecutar(async () => {
    if (!esUuid(id)) throw new ErrorVisible("Datos inválidos.");
    const { sb } = await exigirAdmin();
    const { data: pedido } = await sb.from("orders").select("receipt_path").eq("id", id).maybeSingle();
    const { data, error } = await sb.from("orders").delete().eq("id", id).select("id");
    revisar(error, "No se pudo borrar el pedido");
    if (!data?.length) throw new ErrorVisible("No se pudo borrar el pedido.");
    if (pedido?.receipt_path) await sb.storage.from("receipts").remove([pedido.receipt_path]);
    revalidatePath("/admin");
    return null;
  });
}
