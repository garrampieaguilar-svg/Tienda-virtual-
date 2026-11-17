import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";
import { aNumero } from "@/lib/numeros";

/**
 * Ayudas para el panel de administración.
 *
 * El panel usa la sesión de quien está logueado (no la clave service_role):
 * todo lo que hace pasa por las políticas de RLS de la base. Los controles de
 * acá son una primera barrera y sirven para dar mensajes claros.
 */

export type SesionPersonal = {
  sb: ReturnType<typeof createClient>;
  userId: string;
  email: string;
  rol: Exclude<UserRole, "customer">;
  nombre: string | null;
};

/** La sesión actual si es de alguien del personal (empleado o admin); si no, null. */
export async function sesionPersonal(): Promise<SesionPersonal | null> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (!data || data.role === "customer") return null;
  return { sb, userId: user.id, email: user.email ?? "", rol: data.role, nombre: data.full_name };
}

export async function exigirPersonal(): Promise<SesionPersonal> {
  const sesion = await sesionPersonal();
  if (!sesion) throw new ErrorVisible("Tu sesión venció o no tenés permiso. Volvé a ingresar.");
  return sesion;
}

export async function exigirAdmin(): Promise<SesionPersonal> {
  const sesion = await exigirPersonal();
  if (sesion.rol !== "admin") throw new ErrorVisible("Solo un administrador puede hacer esto.");
  return sesion;
}

/** Error con un mensaje pensado para mostrarle a quien usa el panel. */
export class ErrorVisible extends Error {}

/** Resultado de las acciones del panel. */
export type Resultado<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Ejecuta una acción y convierte cualquier error en un mensaje para la pantalla. */
export async function ejecutar<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ErrorVisible) return { ok: false, error: e.message };
    console.error("Error en el panel:", e);
    return { ok: false, error: "Algo salió mal. Probá de nuevo en un momento." };
  }
}

/** Traduce los errores de la base a mensajes claros y los lanza. */
export function revisar(error: PostgrestError | null, contexto = "No se pudo guardar"): void {
  if (!error) return;
  if (error.code === "P0001") throw new ErrorVisible(error.message); // raise exception de nuestras funciones
  if (error.code === "23505") {
    if (error.message.includes("sku")) throw new ErrorVisible("Ya hay otro producto con ese SKU.");
    if (error.message.includes("barcode")) throw new ErrorVisible("Ya hay otro producto con ese código de barras.");
    if (error.message.includes("slug")) throw new ErrorVisible("Ya hay otra categoría con ese nombre.");
    throw new ErrorVisible("Ese dato ya está cargado en otro registro.");
  }
  if (error.code === "23503") {
    throw new ErrorVisible("No se puede borrar porque hay otros datos que dependen de esto.");
  }
  if (error.code === "23514") throw new ErrorVisible("Hay un valor fuera de rango (por ejemplo, un número negativo).");
  if (error.code === "42501") throw new ErrorVisible("No tenés permiso para hacer esto.");
  console.error(`${contexto}:`, error);
  throw new ErrorVisible(`${contexto}. Probá de nuevo.`);
}

/**
 * Las páginas de la tienda se guardan en caché (ver `revalidate`). Después de un
 * cambio en el panel, esto hace que se vuelvan a generar en la próxima visita.
 */
export function actualizarTienda(): void {
  revalidatePath("/", "layout");
}

/** Lee un texto de un FormData. Vacío → null. */
export function texto(formData: FormData, campo: string, maximo = 500): string | null {
  const valor = formData.get(campo);
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().slice(0, maximo);
  return limpio === "" ? null : limpio;
}

/** Lee un número ("1.234,50" o "1234.5"). Vacío → null. Inválido → error visible. */
export function numero(formData: FormData, campo: string, etiqueta: string): number | null {
  const valor = texto(formData, campo, 30);
  if (valor === null) return null;
  const n = aNumero(valor);
  if (n === null || n < 0) throw new ErrorVisible(`Revisá ${etiqueta}: tiene que ser un número.`);
  return n;
}

export const casilla = (formData: FormData, campo: string) => formData.get(campo) === "on";
