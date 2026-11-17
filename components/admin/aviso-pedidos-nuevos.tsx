"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Cada cuánto se refresca la lista por si se cortó la conexión en vivo. */
const REFRESCO_MS = 60_000;

/**
 * Escucha en vivo los pedidos nuevos (Supabase Realtime) y avisa con un sonido.
 *
 * Los navegadores no dejan reproducir sonido hasta que la persona toca algo en
 * la página, por eso el sonido se activa con un botón cada vez que se abre el panel.
 */
export function AvisoPedidosNuevos({ nuevos }: { nuevos: number }) {
  const router = useRouter();
  const audio = useRef<AudioContext | null>(null);
  const [sonido, setSonido] = useState(false);
  const [recibidos, setRecibidos] = useState<number[]>([]);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    const sb = createClient();
    let canal: ReturnType<typeof sb.channel> | null = null;
    let cancelado = false;

    // Realtime respeta RLS: hay que conectarse CON la sesión del personal (si no,
    // la base no manda los pedidos). Por eso primero se lee la sesión y recién
    // después se abre el canal.
    void sb.auth.getSession().then(async ({ data }) => {
      if (cancelado) return;
      if (data.session) await sb.realtime.setAuth(data.session.access_token);
      canal = sb
        .channel("panel-pedidos")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (cambio) => {
          const numero = (cambio.new as { order_number?: number }).order_number;
          if (numero) setRecibidos((r) => [...r, numero]);
          if (audio.current) sonar(audio.current);
          router.refresh();
        })
        .subscribe((estado) => setConectado(estado === "SUBSCRIBED"));
    });

    const intervalo = setInterval(() => router.refresh(), REFRESCO_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
      if (canal) void sb.removeChannel(canal);
    };
  }, [router]);

  // Título de la pestaña con la cantidad de pedidos nuevos: se ve aunque el panel esté en segundo plano.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = nuevos > 0 ? `(${nuevos}) ${base}` : base;
  }, [nuevos]);

  function activarSonido() {
    const ctx = new AudioContext();
    audio.current = ctx;
    setSonido(true);
    sonar(ctx); // muestra cómo suena
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="flex items-center gap-2 text-neutral-600">
          <span
            aria-hidden
            className={cn("h-2 w-2 rounded-full", conectado ? "bg-accent" : "bg-neutral-300")}
          />
          {conectado ? "Recibiendo pedidos en vivo" : "Conectando…"}
        </span>
        {sonido ? (
          <span className="text-neutral-600">· Aviso con sonido activado</span>
        ) : (
          <button
            type="button"
            onClick={activarSonido}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 font-medium hover:bg-neutral-50"
          >
            Activar aviso con sonido
          </button>
        )}
      </div>
      {recibidos.length > 0 && (
        <p role="status" className="flex items-center justify-between gap-3 rounded-lg bg-accent px-4 py-3 text-accent-fg">
          <span>
            {recibidos.length === 1
              ? `Entró el pedido #${recibidos[0]}`
              : `Entraron ${recibidos.length} pedidos: ${recibidos.map((n) => `#${n}`).join(", ")}`}
          </span>
          <button type="button" onClick={() => setRecibidos([])} className="rounded px-2 text-sm underline">
            Ocultar
          </button>
        </p>
      )}
    </div>
  );
}

/** Dos pitidos cortos, sin archivos de audio. */
function sonar(ctx: AudioContext) {
  if (ctx.state === "suspended") void ctx.resume();
  for (const inicio of [0, 0.28]) {
    const t = ctx.currentTime + inicio;
    const oscilador = ctx.createOscillator();
    const volumen = ctx.createGain();
    oscilador.frequency.value = 880;
    oscilador.connect(volumen);
    volumen.connect(ctx.destination);
    volumen.gain.setValueAtTime(0.0001, t);
    volumen.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    volumen.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    oscilador.start(t);
    oscilador.stop(t + 0.24);
  }
}
