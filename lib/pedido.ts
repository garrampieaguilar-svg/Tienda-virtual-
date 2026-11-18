/**
 * Reglas del pedido que se usan tanto en el navegador como en el servidor:
 * costo de envío, días y franjas disponibles, y textos de estados.
 *
 * OJO: lo que se calcula acá es solo para MOSTRAR. El cálculo que vale es el
 * de la función create_order() de la base, que repite estas mismas reglas.
 */

import type {
  DeliveryMode,
  DeliveryZone,
  OrderStatus,
  PaymentMethod,
  Settings,
  TimeSlot,
} from "@/types/database";

/** Con cuántos días de anticipación se puede pedir (igual que en create_order). */
export const DIAS_HACIA_ADELANTE = 14;

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

export const ETIQUETA_ESTADO: Record<OrderStatus, string> = {
  new: "Recibido",
  preparing: "En preparación",
  ready_for_pickup: "Listo para retirar",
  out_for_delivery: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const ETIQUETA_ENTREGA: Record<DeliveryMode, string> = {
  pickup: "Retiro en el local",
  delivery: "Envío a domicilio",
};

export const ETIQUETA_PAGO: Record<PaymentMethod, string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
};

/** Comprobantes de transferencia: mismos límites que el bucket "receipts". */
export const COMPROBANTE_TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const COMPROBANTE_MAX_BYTES = 10 * 1024 * 1024;

type AjustesEnvio = Pick<Settings, "shipping_mode" | "shipping_fixed_cost" | "free_shipping_from">;

/**
 * Costo de envío estimado.
 * Devuelve null cuando todavía no se puede saber (se cobra por zona y falta elegirla).
 */
export function calcularEnvio(
  ajustes: AjustesEnvio,
  modo: DeliveryMode,
  zona: Pick<DeliveryZone, "cost"> | null | undefined,
  subtotal: number,
): number | null {
  if (modo === "pickup") return 0;
  if (ajustes.free_shipping_from != null && subtotal >= ajustes.free_shipping_from) return 0;
  if (ajustes.shipping_mode === "zones") return zona ? Number(zona.cost) : null;
  return Number(ajustes.shipping_fixed_cost);
}

/** Fecha ("2026-11-17") y hora ("14:05") actuales en Argentina. */
export function ahoraEnArgentina(): { hoy: string; hora: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const v = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return { hoy: `${v("year")}-${v("month")}-${v("day")}`, hora: `${v("hour")}:${v("minute")}` };
}

/** Suma días a una fecha "AAAA-MM-DD" sin que la zona horaria del navegador moleste. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
function diaDeSemana(fecha: string): number {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay();
}

/** "09:00:00" → "09:00" */
const horaCorta = (hora: string) => hora.slice(0, 5);

/** "09:00 a 12:00" (mismo formato que guarda la base en time_slot_label). */
export function etiquetaFranja(franja: Pick<TimeSlot, "start_time" | "end_time">): string {
  return `${horaCorta(franja.start_time)} a ${horaCorta(franja.end_time)}`;
}

/** ¿Hay franjas cargadas para este modo? Si no hay, no se pide día ni horario. */
export function pideHorario(franjas: TimeSlot[], modo: DeliveryMode): boolean {
  return franjas.some((f) => f.delivery_mode === null || f.delivery_mode === modo);
}

/** Franjas que se pueden elegir un día dado. Las de hoy que ya terminaron no se ofrecen. */
export function franjasDelDia(
  franjas: TimeSlot[],
  modo: DeliveryMode,
  fecha: string,
  ahora: { hoy: string; hora: string },
): TimeSlot[] {
  const dia = diaDeSemana(fecha);
  return franjas.filter(
    (f) =>
      (f.delivery_mode === null || f.delivery_mode === modo) &&
      f.weekdays.includes(dia) &&
      (fecha !== ahora.hoy || horaCorta(f.end_time) > ahora.hora),
  );
}

/** Días (desde hoy) que tienen al menos una franja disponible. */
export function diasDisponibles(
  franjas: TimeSlot[],
  modo: DeliveryMode,
  ahora: { hoy: string; hora: string },
): string[] {
  const dias: string[] = [];
  for (let i = 0; i <= DIAS_HACIA_ADELANTE; i++) {
    const fecha = sumarDias(ahora.hoy, i);
    if (franjasDelDia(franjas, modo, fecha, ahora).length > 0) dias.push(fecha);
  }
  return dias;
}

/** "2026-11-17" → "martes 17 de noviembre" (o "Hoy, martes 17 de noviembre"). */
export function formatFecha(fecha: string, hoy?: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  const parte = (opciones: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", ...opciones }).format(d);
  // Se arma a mano para que no dependa de las comas que pone cada navegador.
  const texto = `${parte({ weekday: "long" })} ${d.getUTCDate()} de ${parte({ month: "long" })}`;
  if (hoy && fecha === hoy) return `Hoy, ${texto}`;
  if (hoy && fecha === sumarDias(hoy, 1)) return `Mañana, ${texto}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Deja solo los números de un teléfono. */
export const soloDigitos = (texto: string) => texto.replace(/\D/g, "");

/** Mismo criterio que create_order: entre 8 y 15 dígitos. */
export function telefonoValido(telefono: string): boolean {
  const n = soloDigitos(telefono).length;
  return n >= 8 && n <= 15;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esUuid = (texto: string) => UUID.test(texto);

/**
 * Teléfono en el formato que pide WhatsApp (wa.me), pensado para números de Argentina.
 * "11 2345-6789" · "011 15 2345 6789" · "+54 9 11 2345 6789" → "5491123456789".
 * Si no parece un número argentino, lo deja con sus dígitos tal cual.
 */
export function telefonoParaWhatsapp(telefono: string): string | null {
  const original = soloDigitos(telefono);
  let d = original;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  }
  if (d.startsWith("0")) d = d.slice(1);
  // Formato local con el 15 después del código de área (de 2 a 4 dígitos).
  if (d.length === 12) {
    for (const largo of [2, 3, 4]) {
      if (d.slice(largo, largo + 2) === "15") {
        d = d.slice(0, largo) + d.slice(largo + 2);
        break;
      }
    }
  }
  if (d.length === 10) return `549${d}`;
  return original.length >= 8 ? original : null;
}

/** Estados a los que se puede pasar un pedido desde el panel, en el orden habitual. */
export function siguientesEstados(estado: OrderStatus, modo: DeliveryMode): OrderStatus[] {
  if (estado === "cancelled" || estado === "delivered") return [];
  const listo: OrderStatus = modo === "pickup" ? "ready_for_pickup" : "out_for_delivery";
  const camino: OrderStatus[] = ["new", "preparing", listo, "delivered"];
  return camino.slice(camino.indexOf(estado) + 1);
}
