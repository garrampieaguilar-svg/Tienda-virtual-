import { EsqueletoGrilla } from "@/components/tienda/esqueletos";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Se muestra mientras se buscan los resultados.
 *
 * Está solo en /buscar a propósito: un loading.tsx hace que la página se envíe
 * de a partes, y entonces las páginas que no existen (un producto o una
 * categoría borrados) responden con código 200 en vez de 404, y Google las
 * sigue mostrando. Categorías y productos salen del caché, así que casi nunca
 * hacía falta el esqueleto ahí.
 */
export default function Cargando() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <EsqueletoGrilla />
    </div>
  );
}
