import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioAjustes } from "@/components/admin/formulario-ajustes";
import { ListaFranjas } from "@/components/admin/lista-franjas";
import { ListaZonas } from "@/components/admin/lista-zonas";
import { Tarjeta, Titulo } from "@/components/admin/ui";
import { exigirPersonal } from "@/lib/admin";

export const metadata: Metadata = { title: "Configuración" };

export default async function PaginaConfiguracion() {
  const { sb, rol } = await exigirPersonal();
  if (rol !== "admin") redirect("/admin");

  const [ajustes, zonas, franjas] = await Promise.all([
    sb.from("settings").select("*").eq("id", 1).single(),
    sb.from("delivery_zones").select("*").order("sort_order").order("name"),
    sb.from("time_slots").select("*").order("sort_order").order("start_time"),
  ]);
  if (ajustes.error || zonas.error || franjas.error) throw new Error("No se pudo leer la configuración.");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Titulo>Configuración</Titulo>
      <FormularioAjustes ajustes={ajustes.data} />
      <Tarjeta className="space-y-3">
        <div>
          <h2 className="font-semibold">Zonas de envío</h2>
          <p className="text-sm text-neutral-600">
            Se usan cuando el envío se cobra “según la zona”. Quien compra elige la suya en el checkout.
          </p>
        </div>
        <ListaZonas zonas={(zonas.data ?? []).map((z) => ({ ...z, cost: Number(z.cost) }))} />
      </Tarjeta>
      <Tarjeta className="space-y-3">
        <div>
          <h2 className="font-semibold">Días y horarios de entrega o retiro</h2>
          <p className="text-sm text-neutral-600">
            Si no cargás ninguno, no se pide día ni horario en el checkout. Se puede pedir con hasta 14
            días de anticipación.
          </p>
        </div>
        <ListaFranjas franjas={franjas.data ?? []} />
      </Tarjeta>
    </div>
  );
}
