"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { guardarAjustes } from "@/app/admin/(panel)/configuracion/acciones";
import { SubirImagen } from "@/components/admin/subir-imagen";
import { Tarjeta } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Campo, Input, Select } from "@/components/ui/input";
import type { Settings } from "@/types/database";

const num = (n: number | null) => (n === null ? "" : String(Number(n)).replace(".", ","));

/** Datos del comercio, pagos, envíos y stock. */
export function FormularioAjustes({ ajustes }: { ajustes: Settings }) {
  const router = useRouter();
  const [logo, setLogo] = useState(ajustes.logo_url);
  const [modo, setModo] = useState(ajustes.shipping_mode);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    const datos = new FormData(e.currentTarget);
    datos.set("logo_url", logo ?? "");
    const r = await guardarAjustes(datos);
    setGuardando(false);
    setMensaje(r.ok ? { ok: true, texto: "Configuración guardada." } : { ok: false, texto: r.error });
    if (r.ok) router.refresh();
  }

  const casilla = "h-5 w-5 accent-[rgb(var(--accent))]";

  return (
    <form onSubmit={enviar} className="space-y-6">
      <Tarjeta className="space-y-4">
        <h2 className="font-semibold">Comercio</h2>
        <Campo label="Nombre">
          {(p) => <Input {...p} name="store_name" defaultValue={ajustes.store_name} required maxLength={120} />}
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Dirección" opcional ayuda="Se muestra para el retiro.">
            {(p) => <Input {...p} name="store_address" defaultValue={ajustes.store_address ?? ""} maxLength={200} />}
          </Campo>
          <Campo label="Horario de atención" opcional>
            {(p) => <Input {...p} name="opening_hours" defaultValue={ajustes.opening_hours ?? ""} maxLength={200} />}
          </Campo>
        </div>
        <Campo
          label="WhatsApp del comercio"
          opcional
          ayuda="Con código de país, sin espacios ni el 15. Ej: 5491123456789. Ahí llegan los pedidos."
        >
          {(p) => (
            <Input {...p} name="whatsapp_phone" defaultValue={ajustes.whatsapp_phone ?? ""} inputMode="numeric" maxLength={30} />
          )}
        </Campo>
        <SubirImagen valor={logo} onCambio={setLogo} carpeta="logo" etiqueta="Logo (opcional; si no hay, se muestra el nombre)" />
      </Tarjeta>

      <Tarjeta className="space-y-4">
        <h2 className="font-semibold">Transferencias</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Alias" opcional>
            {(p) => <Input {...p} name="bank_alias" defaultValue={ajustes.bank_alias ?? ""} maxLength={60} />}
          </Campo>
          <Campo label="CBU / CVU" opcional>
            {(p) => <Input {...p} name="bank_cbu" defaultValue={ajustes.bank_cbu ?? ""} inputMode="numeric" maxLength={30} />}
          </Campo>
        </div>
        <Campo label="Titular de la cuenta" opcional>
          {(p) => <Input {...p} name="bank_holder" defaultValue={ajustes.bank_holder ?? ""} maxLength={120} />}
        </Campo>
      </Tarjeta>

      <Tarjeta className="space-y-4">
        <h2 className="font-semibold">Pedidos y envíos</h2>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="pickup_enabled" defaultChecked={ajustes.pickup_enabled} className={casilla} />
            Retiro en el local
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="delivery_enabled" defaultChecked={ajustes.delivery_enabled} className={casilla} />
            Envío a domicilio
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Compra mínima" ayuda="0 = sin mínimo.">
            {(p) => <Input {...p} name="min_order_amount" defaultValue={num(ajustes.min_order_amount)} inputMode="decimal" />}
          </Campo>
          <Campo label="Cómo se cobra el envío">
            {(p) => (
              <Select {...p} name="shipping_mode" value={modo} onChange={(e) => setModo(e.target.value as typeof modo)}>
                <option value="fixed">Monto fijo</option>
                <option value="zones">Según la zona</option>
              </Select>
            )}
          </Campo>
          {modo === "fixed" ? (
            <Campo label="Costo de envío">
              {(p) => <Input {...p} name="shipping_fixed_cost" defaultValue={num(ajustes.shipping_fixed_cost)} inputMode="decimal" />}
            </Campo>
          ) : (
            <input type="hidden" name="shipping_fixed_cost" value={num(ajustes.shipping_fixed_cost)} />
          )}
          <Campo label="Envío gratis desde" opcional ayuda="Vacío = nunca es gratis.">
            {(p) => <Input {...p} name="free_shipping_from" defaultValue={num(ajustes.free_shipping_from)} inputMode="decimal" />}
          </Campo>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="track_stock" defaultChecked={ajustes.track_stock} className={`${casilla} mt-0.5`} />
          <span>
            Controlar stock
            <span className="block text-neutral-600">
              No deja comprar más de lo que hay y descuenta cada pedido. Activalo solo si el stock está al día.
            </span>
          </span>
        </label>
      </Tarjeta>

      {mensaje && (
        <p role={mensaje.ok ? "status" : "alert"} className={mensaje.ok ? "rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent" : "rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"}>
          {mensaje.texto}
        </p>
      )}
      <Button type="submit" tamano="lg" cargando={guardando}>
        Guardar configuración
      </Button>
    </form>
  );
}
