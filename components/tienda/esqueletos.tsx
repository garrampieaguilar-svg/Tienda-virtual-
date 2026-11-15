import { Skeleton } from "@/components/ui/skeleton";
import { GrillaProductos } from "./tarjeta-producto";

/** Tarjeta "fantasma" que se muestra mientras cargan los productos. */
export function EsqueletoTarjeta() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-square" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="mt-2 h-10" />
    </div>
  );
}

export function EsqueletoGrilla({ cantidad = 10 }: { cantidad?: number }) {
  return (
    <div role="status" aria-label="Cargando productos">
      <GrillaProductos>
        {Array.from({ length: cantidad }, (_, i) => (
          <li key={i}>
            <EsqueletoTarjeta />
          </li>
        ))}
      </GrillaProductos>
    </div>
  );
}
