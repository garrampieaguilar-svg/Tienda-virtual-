import { cn } from "@/lib/utils";

/** Bloque gris animado para mostrar mientras carga el contenido. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-neutral-100", className)} />;
}
