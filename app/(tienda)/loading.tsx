import { EsqueletoGrilla } from "@/components/tienda/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

/** Se muestra mientras carga cualquier página de la tienda. */
export default function Cargando() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <EsqueletoGrilla />
    </div>
  );
}
