"use server";

import { revalidatePath } from "next/cache";
import { ejecutar, ErrorVisible, exigirAdmin, revisar } from "@/lib/admin";
import { esUuid } from "@/lib/pedido";
import type { UserRole } from "@/types/database";

export async function cambiarRol(id: string, rol: UserRole) {
  return ejecutar(async () => {
    if (!esUuid(id) || !["customer", "employee", "admin"].includes(rol)) throw new ErrorVisible("Datos inválidos.");
    const { sb, userId } = await exigirAdmin();
    if (id === userId) throw new ErrorVisible("No podés cambiar tu propio rol (así nadie se queda sin administrador).");
    const { data, error } = await sb.from("profiles").update({ role: rol }).eq("id", id).select("id");
    revisar(error, "No se pudo cambiar el rol");
    if (!data?.length) throw new ErrorVisible("No se pudo cambiar el rol.");
    revalidatePath("/admin/usuarios");
    return null;
  });
}
