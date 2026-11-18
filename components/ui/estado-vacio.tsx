import type { ReactNode } from "react";

/** Mensaje centrado para listas vacías o errores ("No encontramos productos", etc.). */
export function EstadoVacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-16 text-center">
      <h2 className="text-lg font-semibold text-neutral-900">{titulo}</h2>
      {descripcion && <p className="text-neutral-600">{descripcion}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  );
}
