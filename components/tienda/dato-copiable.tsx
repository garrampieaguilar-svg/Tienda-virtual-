"use client";

import { useState } from "react";
import { IconoCheck, IconoCopiar } from "@/components/ui/iconos";

/** Un dato con botón para copiarlo (alias, CBU): evita errores al tipearlo en el banco. */
export function DatoCopiable({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso para el portapapeles: el dato igual está a la vista para copiarlo a mano.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <dt className="text-xs text-neutral-600">{etiqueta}</dt>
        <dd className="break-all font-medium tabular-nums">{valor}</dd>
      </div>
      <button
        type="button"
        onClick={copiar}
        aria-label={`Copiar ${etiqueta}`}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium hover:bg-neutral-50"
      >
        {copiado ? <IconoCheck width={16} height={16} /> : <IconoCopiar width={16} height={16} />}
        <span aria-live="polite">{copiado ? "Copiado" : "Copiar"}</span>
      </button>
    </div>
  );
}
