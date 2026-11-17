"use server";

import { redirect } from "next/navigation";
import { telefonoValido } from "@/lib/pedido";
import { createClient } from "@/lib/supabase/server";

export type ResultadoPerfil = { ok: true } | { ok: false; error: string };

const texto = (valor: FormDataEntryValue | null, maximo: number) =>
  typeof valor === "string" ? valor.trim().slice(0, maximo) : "";

/** Guarda los datos de contacto y entrega de quien tiene la sesión abierta. */
export async function guardarPerfil(formData: FormData): Promise<ResultadoPerfil> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión venció. Volvé a ingresar." };

  const telefono = texto(formData.get("telefono"), 30);
  if (telefono && !telefonoValido(telefono)) {
    return { ok: false, error: "Revisá el teléfono." };
  }

  // RLS solo deja editar el perfil propio; el filtro por id es una segunda barrera.
  const { error } = await sb
    .from("profiles")
    .update({
      full_name: texto(formData.get("nombre"), 120) || null,
      phone: telefono || null,
      address: texto(formData.get("direccion"), 300) || null,
      address_notes: texto(formData.get("referencias"), 300) || null,
    })
    .eq("id", user.id);

  if (error) {
    console.error("No se pudo guardar el perfil:", error);
    return { ok: false, error: "No pudimos guardar tus datos. Probá de nuevo." };
  }
  return { ok: true };
}

export async function cerrarSesion() {
  await createClient().auth.signOut();
  redirect("/");
}
