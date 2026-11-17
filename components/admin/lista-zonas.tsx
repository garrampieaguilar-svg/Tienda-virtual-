"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { borrarZona, guardarZona } from "@/app/admin/(panel)/configuracion/acciones";
import { Button } from "@/components/ui/button";
import { aNumero } from "@/lib/numeros";
import type { DeliveryZone } from "@/types/database";

export function ListaZonas({ zonas }: { zonas: DeliveryZone[] }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function correr(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    const r = await accion();
    if (!r.ok) setError(r.error ?? "Algo salió mal.");
    else router.refresh();
    return r.ok;
  }

  return (
    <div className="space-y-2">
      {zonas.map((z) => (
        <FilaZona key={z.id} zona={z} correr={correr} />
      ))}
      <FilaZona zona={null} correr={correr} />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function FilaZona({
  zona,
  correr,
}: {
  zona: DeliveryZone | null;
  correr: (a: () => Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;
}) {
  const [nombre, setNombre] = useState(zona?.name ?? "");
  const [costo, setCosto] = useState(zona ? String(zona.cost).replace(".", ",") : "");
  const [activa, setActiva] = useState(zona?.active ?? true);
  const [ocupado, setOcupado] = useState(false);
  const cambio = !zona || nombre !== zona.name || aNumero(costo) !== Number(zona.cost) || activa !== zona.active;

  async function guardar() {
    setOcupado(true);
    const ok = await correr(() => guardarZona(zona?.id ?? null, nombre, aNumero(costo) ?? -1, activa));
    setOcupado(false);
    if (ok && !zona) {
      setNombre("");
      setCosto("");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        aria-label="Nombre de la zona"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder={zona ? "" : "Nueva zona (ej: Barrio Norte)"}
        maxLength={80}
        className="h-10 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 text-sm"
      />
      <div className="flex h-10 w-28 items-center rounded-lg border border-neutral-300 px-2 text-sm">
        <span className="mr-1 text-neutral-500">$</span>
        <input
          aria-label="Costo de envío"
          value={costo}
          onChange={(e) => setCosto(e.target.value)}
          inputMode="decimal"
          placeholder="Costo"
          className="w-full min-w-0 outline-none"
        />
      </div>
      {zona && (
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
          Activa
        </label>
      )}
      {cambio && (nombre || zona) && (
        <Button type="button" tamano="sm" onClick={guardar} cargando={ocupado}>
          {zona ? "Guardar" : "Agregar"}
        </Button>
      )}
      {zona && (
        <Button
          type="button"
          tamano="sm"
          variante="fantasma"
          className="text-red-700"
          onClick={() => window.confirm(`¿Borrar la zona “${zona.name}”?`) && void correr(() => borrarZona(zona.id))}
        >
          Borrar
        </Button>
      )}
    </div>
  );
}
