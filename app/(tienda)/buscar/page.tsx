import type { Metadata } from "next";
import { ListaInfinita } from "@/components/tienda/lista-infinita";
import { NavCategorias } from "@/components/tienda/nav-categorias";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { getSettings } from "@/lib/data/catalogo";
import { traerPagina, type ModoListado } from "@/lib/data/consultas";
import { createPublicClient } from "@/lib/supabase/publico";

type Props = { searchParams: { q?: string | string[] } };

export function generateMetadata({ searchParams }: Props): Metadata {
  const q = leerConsulta(searchParams);
  return { title: q ? `Resultados para “${q}”` : "Buscar", robots: { index: false } };
}

function leerConsulta(searchParams: Props["searchParams"]): string {
  const valor = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q;
  return (valor ?? "").trim().slice(0, 100);
}

export default async function PaginaBuscar({ searchParams }: Props) {
  const q = leerConsulta(searchParams);

  if (q.length < 2) {
    return (
      <div className="space-y-6">
        <NavCategorias />
        <EstadoVacio
          titulo="¿Qué estás buscando?"
          descripcion="Escribí al menos dos letras en el buscador de arriba."
        />
      </div>
    );
  }

  const modo: ModoListado = { tipo: "buscar", q };
  const [settings, primera] = await Promise.all([
    getSettings(),
    traerPagina(createPublicClient(), modo, 0),
  ]);

  return (
    <div className="space-y-6">
      <NavCategorias />
      <h1 className="text-xl font-semibold tracking-tight">Resultados para “{q}”</h1>
      {primera.productos.length === 0 ? (
        <EstadoVacio
          titulo="No encontramos nada"
          descripcion="Probá con otra palabra, con menos palabras o con la marca."
        />
      ) : (
        <ListaInfinita
          key={q}
          modo={modo}
          iniciales={primera.productos}
          hayMasInicial={primera.hayMas}
          controlarStock={settings.track_stock}
        />
      )}
    </div>
  );
}
