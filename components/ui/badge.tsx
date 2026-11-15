import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tono = "neutro" | "acento" | "oferta" | "aviso" | "peligro";

const tonos: Record<Tono, string> = {
  neutro: "bg-neutral-100 text-neutral-700",
  acento: "bg-accent-soft text-accent",
  oferta: "bg-accent text-accent-fg",
  aviso: "bg-amber-50 text-amber-800",
  peligro: "bg-red-50 text-red-700",
};

/** Etiqueta chica: "Oferta", "-20%", "Sin stock", estados de pedido, etc. */
export function Badge({
  tono = "neutro",
  className,
  children,
}: {
  tono?: Tono;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        tonos[tono],
        className,
      )}
    >
      {children}
    </span>
  );
}
