"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { borrarFranja, guardarFranja } from "@/app/admin/(panel)/configuracion/acciones";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DeliveryMode, TimeSlot } from "@/types/database";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]; // la semana arranca el lunes

export function ListaFranjas({ franjas }: { franjas: TimeSlot[] }) {
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
    <div className="space-y-3">
      {franjas.map((f) => (
        <FilaFranja key={f.id} franja={f} correr={correr} />
      ))}
      <FilaFranja franja={null} correr={correr} />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function FilaFranja({
  franja,
  correr,
}: {
  franja: TimeSlot | null;
  correr: (a: () => Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;
}) {
  const [modo, setModo] = useState<DeliveryMode | null>(franja?.delivery_mode ?? null);
  const [dias, setDias] = useState<number[]>(franja?.weekdays ?? [1, 2, 3, 4, 5, 6]);
  const [desde, setDesde] = useState(franja?.start_time.slice(0, 5) ?? "");
  const [hasta, setHasta] = useState(franja?.end_time.slice(0, 5) ?? "");
  const [activa, setActiva] = useState(franja?.active ?? true);
  const [ocupado, setOcupado] = useState(false);

  async function guardar() {
    setOcupado(true);
    const ok = await correr(() => guardarFranja(franja?.id ?? null, { modo, dias, desde, hasta, activa }));
    setOcupado(false);
    if (ok && !franja) {
      setDesde("");
      setHasta("");
    }
  }

  return (
    <div className={cn("space-y-2 rounded-lg border p-3", franja ? "border-neutral-200" : "border-dashed border-neutral-300")}>
      {!franja && <p className="text-sm font-medium">Agregar horario</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Desde" type="time" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-10 rounded-lg border border-neutral-300 px-2 text-sm" />
        <span className="text-sm text-neutral-600">a</span>
        <input aria-label="Hasta" type="time" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-10 rounded-lg border border-neutral-300 px-2 text-sm" />
        <select
          aria-label="Para qué sirve"
          value={modo ?? ""}
          onChange={(e) => setModo((e.target.value || null) as DeliveryMode | null)}
          className="h-10 rounded-lg border border-neutral-300 bg-white px-2 text-sm"
        >
          <option value="">Retiro y envío</option>
          <option value="pickup">Solo retiro</option>
          <option value="delivery">Solo envío</option>
        </select>
        {franja && (
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
            Activo
          </label>
        )}
      </div>
      <fieldset className="flex flex-wrap gap-1">
        <legend className="sr-only">Días</legend>
        {ORDEN_DIAS.map((d) => {
          const marcado = dias.includes(d);
          return (
            <label
              key={d}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                marcado ? "border-accent bg-accent-soft text-accent" : "border-neutral-300 text-neutral-600",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={marcado}
                onChange={() => setDias((x) => (marcado ? x.filter((y) => y !== d) : [...x, d]))}
              />
              {DIAS[d]}
            </label>
          );
        })}
      </fieldset>
      <div className="flex gap-2">
        <Button type="button" tamano="sm" onClick={guardar} cargando={ocupado} disabled={!desde || !hasta}>
          {franja ? "Guardar" : "Agregar"}
        </Button>
        {franja && (
          <Button
            type="button"
            tamano="sm"
            variante="fantasma"
            className="text-red-700"
            onClick={() => window.confirm("¿Borrar este horario?") && void correr(() => borrarFranja(franja.id))}
          >
            Borrar
          </Button>
        )}
      </div>
    </div>
  );
}
