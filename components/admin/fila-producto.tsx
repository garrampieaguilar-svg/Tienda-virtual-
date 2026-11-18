"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { cambioRapido } from "@/app/admin/(panel)/productos/acciones";
import { aNumero } from "@/lib/numeros";
import { cn } from "@/lib/utils";

type ProductoFila = {
  id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  price: number;
  stock: number;
  active: boolean;
  on_sale: boolean;
  image_url: string | null;
};

/**
 * Una fila de la tabla de productos. Precio, stock, oferta y visible se cambian
 * ahí mismo (se guarda al salir del campo o al apretar Enter).
 */
export function FilaProducto({ producto }: { producto: ProductoFila }) {
  const [valores, setValores] = useState(producto);
  const [estado, setEstado] = useState<"" | "guardando" | "guardado" | "error">("");
  const [error, setError] = useState("");

  async function guardar<K extends "price" | "stock" | "active" | "on_sale">(campo: K, valor: ProductoFila[K]) {
    const anterior = valores[campo];
    if (anterior === valor) return;
    setValores((v) => ({ ...v, [campo]: valor }));
    setEstado("guardando");
    const r = await cambioRapido(producto.id, campo, valor);
    if (r.ok) {
      setEstado("guardado");
      setTimeout(() => setEstado((e) => (e === "guardado" ? "" : e)), 1500);
    } else {
      setValores((v) => ({ ...v, [campo]: anterior }));
      setEstado("error");
      setError(r.error);
    }
  }

  return (
    <tr className={cn(!valores.active && "bg-neutral-50 text-neutral-500")}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-neutral-100">
            <Image src={valores.image_url || "/placeholder-producto.svg"} alt="" fill sizes="40px" className="object-contain" />
          </div>
          <div className="min-w-0">
            <Link href={`/admin/productos/${producto.id}`} className="line-clamp-2 font-medium text-neutral-900 hover:underline">
              {producto.name}
            </Link>
            {producto.brand && <p className="truncate text-xs text-neutral-500">{producto.brand}</p>}
            {estado === "guardando" && <p className="text-xs text-neutral-500">Guardando…</p>}
            {estado === "guardado" && <p className="text-xs text-accent">Guardado</p>}
            {estado === "error" && (
              <p role="alert" className="text-xs text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-xs tabular-nums text-neutral-600">
        {producto.sku ?? "—"}
        {producto.barcode && <span className="block">{producto.barcode}</span>}
      </td>
      <td className="px-3 py-2">
        <CampoNumero
          etiqueta={`Precio de ${producto.name}`}
          valor={valores.price}
          prefijo="$"
          alerta={valores.price <= 0}
          onGuardar={(n) => guardar("price", n)}
        />
      </td>
      <td className="px-3 py-2">
        <CampoNumero
          etiqueta={`Stock de ${producto.name}`}
          valor={valores.stock}
          alerta={valores.stock <= 0}
          onGuardar={(n) => guardar("stock", n)}
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          aria-label={`${producto.name} en oferta`}
          checked={valores.on_sale}
          onChange={(e) => guardar("on_sale", e.target.checked)}
          className="h-5 w-5 accent-[rgb(var(--accent))]"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          aria-label={`${producto.name} visible en la tienda`}
          checked={valores.active}
          onChange={(e) => guardar("active", e.target.checked)}
          className="h-5 w-5 accent-[rgb(var(--accent))]"
        />
      </td>
    </tr>
  );
}

function CampoNumero({
  etiqueta,
  valor,
  prefijo,
  alerta,
  onGuardar,
}: {
  etiqueta: string;
  valor: number;
  prefijo?: string;
  alerta?: boolean;
  onGuardar: (n: number) => void;
}) {
  const formato = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n);
  const [texto, setTexto] = useState(formato(valor));

  function confirmar() {
    const n = aNumero(texto);
    if (n === null || n < 0) {
      setTexto(formato(valor));
      return;
    }
    setTexto(formato(n));
    onGuardar(n);
  }

  return (
    <div
      className={cn(
        "flex h-9 items-center rounded-md border bg-white px-2 focus-within:border-accent",
        alerta ? "border-amber-400" : "border-neutral-300",
      )}
    >
      {prefijo && <span className="mr-1 text-neutral-500">{prefijo}</span>}
      <input
        aria-label={etiqueta}
        value={texto}
        inputMode="decimal"
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setTexto(formato(valor));
            e.currentTarget.blur();
          }
        }}
        className="w-full min-w-0 bg-transparent text-sm tabular-nums outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}
