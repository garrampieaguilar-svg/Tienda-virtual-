"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
const MAXIMO = 5 * 1024 * 1024;

/**
 * Sube una imagen al bucket público "products" y devuelve su URL.
 * La sube el navegador con la sesión de quien está en el panel: las políticas de
 * Storage solo dejan subir al personal.
 */
export function SubirImagen({
  valor,
  onCambio,
  carpeta = "productos",
  etiqueta = "Foto",
}: {
  valor: string | null;
  onCambio: (url: string | null) => void;
  carpeta?: string;
  etiqueta?: string;
}) {
  const id = useId();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  async function subir(archivo: File) {
    setError("");
    const extension = TIPOS[archivo.type];
    if (!extension) return setError("Tiene que ser JPG, PNG, WebP o AVIF.");
    if (archivo.size > MAXIMO) return setError("La imagen pesa más de 5 MB. Achicala y probá de nuevo.");
    setSubiendo(true);
    const sb = createClient();
    const ruta = `${carpeta}/${crypto.randomUUID()}.${extension}`;
    const { error: fallo } = await sb.storage
      .from("products")
      .upload(ruta, archivo, { contentType: archivo.type, cacheControl: "31536000" });
    setSubiendo(false);
    if (fallo) return setError("No se pudo subir la imagen. Probá de nuevo.");
    onCambio(sb.storage.from("products").getPublicUrl(ruta).data.publicUrl);
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-neutral-800">
        {etiqueta}
      </label>
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
          <Image src={valor || "/placeholder-producto.svg"} alt="" fill sizes="96px" className="object-contain" />
        </div>
        <div className="space-y-2">
          <input
            id={id}
            type="file"
            accept={Object.keys(TIPOS).join(",")}
            disabled={subiendo}
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) void subir(archivo);
              e.target.value = "";
            }}
            className="block w-full text-sm text-neutral-700 file:mr-3 file:h-9 file:cursor-pointer file:rounded-lg file:border file:border-solid file:border-neutral-300 file:bg-white file:px-3 file:text-sm file:font-medium hover:file:bg-neutral-50"
          />
          {subiendo && <p className="text-sm text-neutral-600">Subiendo…</p>}
          {valor && !subiendo && (
            <button type="button" onClick={() => onCambio(null)} className="text-sm text-red-700 underline underline-offset-2">
              Quitar imagen
            </button>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
