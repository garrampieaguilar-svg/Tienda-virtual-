"use server";

import { revalidatePath } from "next/cache";
import { actualizarTienda, casilla, ejecutar, ErrorVisible, exigirAdmin, numero, revisar, texto } from "@/lib/admin";
import { esUuid, soloDigitos } from "@/lib/pedido";
import type { DeliveryMode } from "@/types/database";

function terminar() {
  actualizarTienda();
  revalidatePath("/admin/configuracion");
  return null;
}

export async function guardarAjustes(formData: FormData) {
  return ejecutar(async () => {
    const { sb } = await exigirAdmin();
    const nombre = texto(formData, "store_name", 120);
    if (!nombre) throw new ErrorVisible("El comercio necesita un nombre.");
    const whatsapp = soloDigitos(texto(formData, "whatsapp_phone", 30) ?? "");
    if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) {
      throw new ErrorVisible("El WhatsApp va con código de país y sin espacios. Ej: 5491123456789.");
    }
    const logo = texto(formData, "logo_url", 1000);
    if (logo && !/^https:\/\//.test(logo)) throw new ErrorVisible("El logo tiene que ser un link https.");
    const retiro = casilla(formData, "pickup_enabled");
    const envio = casilla(formData, "delivery_enabled");
    if (!retiro && !envio) {
      throw new ErrorVisible("Dejá activado al menos retiro o envío (si no, nadie puede comprar).");
    }
    const modo = texto(formData, "shipping_mode");
    if (modo !== "fixed" && modo !== "zones") throw new ErrorVisible("Elegí cómo se cobra el envío.");

    const { data, error } = await sb
      .from("settings")
      .update({
        store_name: nombre,
        store_address: texto(formData, "store_address", 200),
        whatsapp_phone: whatsapp || null,
        opening_hours: texto(formData, "opening_hours", 200),
        logo_url: logo,
        bank_alias: texto(formData, "bank_alias", 60),
        bank_cbu: texto(formData, "bank_cbu", 30),
        bank_holder: texto(formData, "bank_holder", 120),
        min_order_amount: numero(formData, "min_order_amount", "la compra mínima") ?? 0,
        pickup_enabled: retiro,
        delivery_enabled: envio,
        shipping_mode: modo,
        shipping_fixed_cost: numero(formData, "shipping_fixed_cost", "el costo de envío") ?? 0,
        free_shipping_from: numero(formData, "free_shipping_from", "el envío gratis"),
        track_stock: casilla(formData, "track_stock"),
      })
      .eq("id", 1)
      .select("id");
    revisar(error, "No se pudo guardar la configuración");
    if (!data?.length) throw new ErrorVisible("No se pudo guardar la configuración.");
    return terminar();
  });
}

// ---------- Zonas de envío ----------

export async function guardarZona(id: string | null, nombre: string, costo: number, activa: boolean) {
  return ejecutar(async () => {
    const { sb } = await exigirAdmin();
    const limpio = nombre.trim().slice(0, 80);
    if (!limpio) throw new ErrorVisible("La zona necesita un nombre.");
    if (!Number.isFinite(costo) || costo < 0) throw new ErrorVisible("Revisá el costo.");
    if (id) {
      if (!esUuid(id)) throw new ErrorVisible("Datos inválidos.");
      const { error } = await sb.from("delivery_zones").update({ name: limpio, cost: costo, active: activa }).eq("id", id);
      revisar(error, "No se pudo guardar la zona");
    } else {
      const { count } = await sb.from("delivery_zones").select("id", { count: "exact", head: true });
      const { error } = await sb.from("delivery_zones").insert({ name: limpio, cost: costo, sort_order: (count ?? 0) + 1 });
      revisar(error, "No se pudo crear la zona");
    }
    return terminar();
  });
}

export async function borrarZona(id: string) {
  return ejecutar(async () => {
    if (!esUuid(id)) throw new ErrorVisible("Datos inválidos.");
    const { sb } = await exigirAdmin();
    const { error } = await sb.from("delivery_zones").delete().eq("id", id);
    revisar(error, "No se pudo borrar la zona");
    return terminar();
  });
}

// ---------- Franjas horarias ----------

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function guardarFranja(
  id: string | null,
  datos: { modo: DeliveryMode | null; dias: number[]; desde: string; hasta: string; activa: boolean },
) {
  return ejecutar(async () => {
    const { sb } = await exigirAdmin();
    if (!HORA.test(datos.desde) || !HORA.test(datos.hasta)) throw new ErrorVisible("Revisá los horarios (formato 09:00).");
    if (datos.hasta <= datos.desde) throw new ErrorVisible("El horario de fin tiene que ser después del de inicio.");
    const dias = [...new Set(datos.dias)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
    if (!dias.length) throw new ErrorVisible("Elegí al menos un día.");
    if (datos.modo !== null && datos.modo !== "pickup" && datos.modo !== "delivery") throw new ErrorVisible("Datos inválidos.");
    const fila = {
      delivery_mode: datos.modo,
      weekdays: dias,
      start_time: datos.desde,
      end_time: datos.hasta,
      active: Boolean(datos.activa),
    };
    if (id) {
      if (!esUuid(id)) throw new ErrorVisible("Datos inválidos.");
      const { error } = await sb.from("time_slots").update(fila).eq("id", id);
      revisar(error, "No se pudo guardar el horario");
    } else {
      const { count } = await sb.from("time_slots").select("id", { count: "exact", head: true });
      const { error } = await sb.from("time_slots").insert({ ...fila, sort_order: (count ?? 0) + 1 });
      revisar(error, "No se pudo crear el horario");
    }
    return terminar();
  });
}

export async function borrarFranja(id: string) {
  return ejecutar(async () => {
    if (!esUuid(id)) throw new ErrorVisible("Datos inválidos.");
    const { sb } = await exigirAdmin();
    const { error } = await sb.from("time_slots").delete().eq("id", id);
    revisar(error, "No se pudo borrar el horario");
    return terminar();
  });
}
