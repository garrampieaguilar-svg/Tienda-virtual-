"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  traerPagina,
  type ModoListado,
  type ProductoTarjeta,
} from "@/lib/data/consultas";
import { createClient } from "@/lib/supabase/client";
import { EsqueletoTarjeta } from "./esqueletos";
import { GrillaProductos, TarjetaProducto } from "./tarjeta-producto";

/**
 * Listado de productos con scroll infinito.
 *
 * La primera página llega ya dibujada desde el servidor (rápido y visible para
 * buscadores). Cuando la persona se acerca al final, se pide la página siguiente
 * directo a Supabase. Así el catálogo se mantiene liviano aunque haya miles de productos.
 */
export function ListaInfinita({
  modo,
  iniciales,
  hayMasInicial,
  controlarStock,
}: {
  modo: ModoListado;
  iniciales: ProductoTarjeta[];
  hayMasInicial: boolean;
  controlarStock: boolean;
}) {
  const [productos, setProductos] = useState(iniciales);
  const [hayMas, setHayMas] = useState(hayMasInicial);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const pagina = useRef(1); // la 0 ya vino del servidor
  const ocupado = useRef(false);
  const centinela = useRef<HTMLDivElement>(null);

  const cargarMas = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setCargando(true);
    setError(false);
    try {
      const resultado = await traerPagina(createClient(), modo, pagina.current);
      pagina.current += 1;
      setProductos((previos) => {
        // Por si un producto cambió de posición entre páginas: no repetir.
        const vistos = new Set(previos.map((p) => p.id));
        return [...previos, ...resultado.productos.filter((p) => !vistos.has(p.id))];
      });
      setHayMas(resultado.hayMas);
    } catch {
      setError(true);
    } finally {
      ocupado.current = false;
      setCargando(false);
    }
  }, [modo]);

  // Cuando el "centinela" del final entra en pantalla, cargamos la página siguiente.
  useEffect(() => {
    const elemento = centinela.current;
    if (!elemento || !hayMas || error) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) void cargarMas();
      },
      { rootMargin: "600px" }, // empezamos a cargar antes de que llegue al final
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [hayMas, error, cargarMas, productos.length]);

  return (
    <div>
      <GrillaProductos>
        {productos.map((producto) => (
          <li key={producto.id}>
            <TarjetaProducto producto={producto} controlarStock={controlarStock} />
          </li>
        ))}
        {cargando &&
          Array.from({ length: 5 }, (_, i) => (
            <li key={`esqueleto-${i}`} aria-hidden>
              <EsqueletoTarjeta />
            </li>
          ))}
      </GrillaProductos>

      <div ref={centinela} className="flex min-h-px flex-col items-center gap-3 pt-8" aria-live="polite">
        {error && (
          <>
            <p className="text-sm text-neutral-600">No pudimos cargar más productos.</p>
            <Button variante="secundario" onClick={() => void cargarMas()}>
              Reintentar
            </Button>
          </>
        )}
        {/* Alternativa al scroll para quien navega con teclado o lector de pantalla. */}
        {hayMas && !error && !cargando && (
          <Button variante="secundario" onClick={() => void cargarMas()}>
            Ver más productos
          </Button>
        )}
        {cargando && <span className="sr-only">Cargando más productos…</span>}
      </div>
    </div>
  );
}
