import type { Metadata } from "next";
import { ListaInfinita } from "@/components/tienda/lista-infinita";
import { NavCategorias } from "@/components/tienda/nav-categorias";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { getSettings } from "@/lib/data/catalogo";
import { traerPagina, type ModoListado } from "@/lib/data/consultas";
import { createPublicClient } from "@/lib/supabase/publico";

export const revalidate = 60;
export const metadata: Metadata = { title: "Ofertas" };

const modo: ModoListado = { tipo: "ofertas" };

export default async function PaginaOfertas() {
  const [settings, primera] = await Promise.all([
    getSettings(),
    traerPagina(createPublicClient(), modo, 0),
  ]);

  return (
    <div className="space-y-6">
      <NavCategorias activa="ofertas" />
      <h1 className="text-xl font-semibold tracking-tight">Ofertas</h1>
      {primera.productos.length === 0 ? (
        <EstadoVacio
          titulo="Hoy no hay ofertas"
          descripcion="Volvé a pasar pronto: las vamos renovando."
        />
      ) : (
        <ListaInfinita
          modo={modo}
          iniciales={primera.productos}
          hayMasInicial={primera.hayMas}
          controlarStock={settings.track_stock}
        />
      )}
    </div>
  );
}
