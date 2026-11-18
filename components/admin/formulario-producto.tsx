"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { borrarProducto, guardarProducto } from "@/app/admin/(panel)/productos/acciones";
import { SubirImagen } from "@/components/admin/subir-imagen";
import { Tarjeta } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/input";
import type { Product } from "@/types/database";

const num = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3, useGrouping: false }).format(Number(n));

/** Formulario de alta y edición de un producto. */
export function FormularioProducto({
  producto,
  categorias,
}: {
  producto: Product | null;
  categorias: { id: string; texto: string }[];
}) {
  const router = useRouter();
  const [imagen, setImagen] = useState<string | null>(producto?.image_url ?? null);
  const [venta, setVenta] = useState(producto?.sale_unit ?? "unidad");
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    setGuardado(false);
    const datos = new FormData(e.currentTarget);
    datos.set("image_url", imagen ?? "");
    const r = await guardarProducto(producto?.id ?? null, datos);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    if (!producto) {
      router.replace(`/admin/productos/${r.data}?creado=1`);
    } else {
      setGuardado(true);
      router.refresh();
    }
  }

  async function borrar() {
    if (!producto) return;
    if (!window.confirm(`¿Borrar “${producto.name}” para siempre? Si solo querés que no se vea, destildá “Visible en la tienda”.`)) return;
    setBorrando(true);
    const r = await borrarProducto(producto.id);
    if (!r.ok) {
      setBorrando(false);
      return setError(r.error);
    }
    router.replace("/admin/productos");
    router.refresh();
  }

  const porMedida = venta === "kilo" || venta === "litro";

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Tarjeta className="space-y-4">
        <Campo label="Nombre">
          {(p) => <Input {...p} name="name" defaultValue={producto?.name ?? ""} required maxLength={200} />}
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Marca" opcional>
            {(p) => <Input {...p} name="brand" defaultValue={producto?.brand ?? ""} maxLength={120} />}
          </Campo>
          <Campo label="Categoría" opcional>
            {(p) => (
              <Select {...p} name="category_id" defaultValue={producto?.category_id ?? ""}>
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.texto}
                  </option>
                ))}
              </Select>
            )}
          </Campo>
          <Campo label="SKU (código interno)" opcional>
            {(p) => <Input {...p} name="sku" defaultValue={producto?.sku ?? ""} maxLength={60} />}
          </Campo>
          <Campo label="Código de barras" opcional>
            {(p) => <Input {...p} name="barcode" defaultValue={producto?.barcode ?? ""} inputMode="numeric" maxLength={60} />}
          </Campo>
        </div>
        <Campo label="Descripción" opcional>
          {(p) => <Textarea {...p} name="description" defaultValue={producto?.description ?? ""} maxLength={4000} />}
        </Campo>
        <SubirImagen valor={imagen} onCambio={setImagen} />
      </Tarjeta>

      <Tarjeta className="space-y-4">
        <h2 className="font-semibold">Precio y venta</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Cómo se vende">
            {(p) => (
              <Select {...p} name="sale_unit" value={venta} onChange={(e) => setVenta(e.target.value as typeof venta)}>
                <option value="unidad">Por unidad</option>
                <option value="pack">Por pack</option>
                <option value="kilo">Por kilo</option>
                <option value="litro">Por litro</option>
              </Select>
            )}
          </Campo>
          <Campo
            label="De a cuánto se suma en el carrito"
            ayuda={porMedida ? "Ej: 0,25 para pedir de a 250 g." : "Normalmente 1."}
          >
            {(p) => (
              <Input {...p} name="quantity_step" defaultValue={num(producto?.quantity_step ?? 1)} inputMode="decimal" />
            )}
          </Campo>
          <Campo label={porMedida ? `Precio por ${venta === "kilo" ? "kilo" : "litro"}` : "Precio"} ayuda="0 = todavía sin precio (se muestra pero no se puede comprar).">
            {(p) => <Input {...p} name="price" defaultValue={num(producto?.price ?? 0)} inputMode="decimal" required />}
          </Campo>
          <Campo label="Precio anterior" opcional ayuda="Se muestra tachado cuando está en oferta.">
            {(p) => <Input {...p} name="previous_price" defaultValue={num(producto?.previous_price)} inputMode="decimal" />}
          </Campo>
          {!porMedida && (
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <Campo label="Contenido" opcional ayuda="Para calcular el precio por kilo o litro.">
                {(p) => <Input {...p} name="net_content" defaultValue={num(producto?.net_content)} inputMode="decimal" />}
              </Campo>
              <Campo label="Unidad">
                {(p) => (
                  <Select {...p} name="net_content_unit" defaultValue={producto?.net_content_unit ?? ""}>
                    <option value="">—</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="l">l</option>
                    <option value="un">un</option>
                  </Select>
                )}
              </Campo>
            </div>
          )}
          <Campo label="Stock" ayuda="Solo limita las compras si está activado “Controlar stock” en Configuración.">
            {(p) => <Input {...p} name="stock" defaultValue={num(producto?.stock ?? 0)} inputMode="decimal" />}
          </Campo>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="on_sale" defaultChecked={producto?.on_sale ?? false} className="h-5 w-5 accent-[rgb(var(--accent))]" />
            En oferta
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={producto?.active ?? true} className="h-5 w-5 accent-[rgb(var(--accent))]" />
            Visible en la tienda
          </label>
        </div>
      </Tarjeta>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {guardado && (
        <p role="status" className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent">
          Cambios guardados. La tienda se actualiza en la próxima visita.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" tamano="lg" cargando={guardando}>
          {producto ? "Guardar cambios" : "Crear producto"}
        </Button>
        {producto && (
          <Button type="button" variante="fantasma" className="text-red-700" onClick={borrar} cargando={borrando}>
            Borrar producto
          </Button>
        )}
      </div>
    </form>
  );
}
