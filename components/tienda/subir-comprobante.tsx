"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { subirComprobante } from "@/app/(tienda)/checkout/acciones";
import { Button } from "@/components/ui/button";
import { IconoCheck } from "@/components/ui/iconos";
import { COMPROBANTE_MAX_BYTES, COMPROBANTE_TIPOS } from "@/lib/pedido";

/**
 * Subida del comprobante de transferencia desde la pantalla del pedido.
 * Sirve para quien transfiere después de confirmar, o para reemplazar uno mal subido.
 */
export function SubirComprobante({
  pedidoId,
  yaSubido,
  avisoInicial,
}: {
  pedidoId: string;
  yaSubido: boolean;
  /** Mensaje a mostrar de entrada (por ej. si falló la subida hecha en el checkout). */
  avisoInicial?: string;
}) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(avisoInicial ?? "");
  const [recienSubido, setRecienSubido] = useState(false);

  async function subir() {
    if (!archivo) {
      setError("Elegí el archivo del comprobante.");
      return;
    }
    if (!COMPROBANTE_TIPOS[archivo.type]) {
      setError("Tiene que ser una foto (JPG, PNG, WebP) o un PDF.");
      return;
    }
    if (archivo.size > COMPROBANTE_MAX_BYTES) {
      setError("El archivo es muy pesado: el máximo es 10 MB.");
      return;
    }

    setSubiendo(true);
    setError("");
    try {
      const datos = new FormData();
      datos.set("pedido_id", pedidoId);
      datos.set("comprobante", archivo);
      const resultado = await subirComprobante(datos);
      if (!resultado.ok) {
        setError(resultado.error);
      } else {
        setRecienSubido(true);
        setArchivo(null);
        if (input.current) input.current.value = "";
        router.refresh(); // vuelve a leer el pedido: el mensaje de WhatsApp ya dice "subí el comprobante"
      }
    } catch {
      setError("No pudimos subir el comprobante. Revisá tu conexión y probá de nuevo.");
    } finally {
      setSubiendo(false);
    }
  }

  const subido = yaSubido || recienSubido;

  return (
    <div className="space-y-3">
      {subido && (
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-accent">
          <IconoCheck width={18} height={18} />
          Recibimos tu comprobante.
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor={id} className="block text-sm font-medium text-neutral-800">
          {subido ? "¿Subiste el archivo equivocado? Reemplazalo" : "Subí el comprobante"}
        </label>
        <input
          ref={input}
          id={id}
          type="file"
          accept={Object.keys(COMPROBANTE_TIPOS).join(",")}
          onChange={(ev) => {
            setArchivo(ev.target.files?.[0] ?? null);
            setError("");
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-ayuda`}
          className="block w-full rounded-lg text-sm text-neutral-700 file:mr-3 file:h-10 file:cursor-pointer file:rounded-lg file:border file:border-solid file:border-neutral-300 file:bg-white file:px-4 file:text-sm file:font-medium file:text-neutral-900 hover:file:bg-neutral-50"
        />
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : (
          <p id={`${id}-ayuda`} className="text-sm text-neutral-600">
            Foto o PDF, hasta 10 MB.
          </p>
        )}
      </div>

      {archivo && (
        <Button type="button" variante="secundario" onClick={subir} cargando={subiendo}>
          {subiendo ? "Subiendo…" : "Enviar comprobante"}
        </Button>
      )}
    </div>
  );
}
