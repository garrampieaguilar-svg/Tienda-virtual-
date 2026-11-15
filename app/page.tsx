import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatContenido, formatPrecio, precioPorUnidadDeMedida } from "@/lib/format";

/**
 * Página TEMPORAL de la Etapa 1: muestra la base visual (colores, tipografía,
 * componentes) para validar el estilo. En la Etapa 3 se reemplaza por la home real.
 */
export default function Home() {
  return (
    <main className="mx-auto max-w-content space-y-12 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Base del proyecto lista</h1>
        <p className="text-neutral-600">
          Esto es una vista previa del estilo. La tienda real se arma en las próximas etapas.
        </p>
      </header>

      <section className="space-y-4" aria-labelledby="botones">
        <h2 id="botones" className="text-lg font-semibold">
          Botones
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button>Agregar al carrito</Button>
          <Button variante="secundario">Seguir comprando</Button>
          <Button variante="fantasma">Cancelar</Button>
          <Button cargando>Confirmando</Button>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="etiquetas">
        <h2 id="etiquetas" className="text-lg font-semibold">
          Etiquetas
        </h2>
        <div className="flex flex-wrap gap-2">
          <Badge tono="oferta">-20%</Badge>
          <Badge tono="acento">Nuevo</Badge>
          <Badge>Almacén</Badge>
          <Badge tono="aviso">Últimas unidades</Badge>
          <Badge tono="peligro">Sin stock</Badge>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="producto">
        <h2 id="producto" className="text-lg font-semibold">
          Tarjeta de producto (borrador)
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <article className="flex flex-col gap-2">
            <div className="relative aspect-square overflow-hidden rounded-lg">
              <Image
                src="/placeholder-producto.svg"
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 20vw"
              />
            </div>
            <h3 className="line-clamp-2 text-sm text-neutral-800">Yerba mate suave 500 g</h3>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold">{formatPrecio(2400)}</span>
              <span className="text-xs text-neutral-500 line-through">{formatPrecio(3000)}</span>
            </div>
            <p className="text-xs text-neutral-600">
              {formatContenido(500, "g")} · {precioPorUnidadDeMedida(2400, 500, "g")}
            </p>
          </article>
          <div className="flex flex-col gap-2">
            <Skeleton className="aspect-square" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </section>

      <section className="max-w-sm space-y-4" aria-labelledby="form">
        <h2 id="form" className="text-lg font-semibold">
          Formularios
        </h2>
        <Campo label="Teléfono (WhatsApp)" ayuda="Te escribimos por acá si hay algún cambio.">
          {(p) => <Input type="tel" placeholder="11 2345 6789" {...p} />}
        </Campo>
        <Campo label="Email" opcional error="Revisá el email, parece que le falta algo.">
          {(p) => <Input type="email" defaultValue="juan@" {...p} />}
        </Campo>
      </section>
    </main>
  );
}
