"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { IconoBuscar, IconoCerrar } from "@/components/ui/iconos";
import { Spinner } from "@/components/ui/spinner";
import { COLUMNAS_TARJETA, type ProductoTarjeta } from "@/lib/data/consultas";
import { formatPrecio } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ImagenProducto } from "./imagen-producto";

const MINIMO_LETRAS = 2;
const MAXIMO_SUGERENCIAS = 6;
const ESPERA_MS = 200;

/**
 * Buscador con resultados instantáneos mientras se escribe.
 *
 * - Espera 200 ms después de la última tecla antes de consultar (no satura la base).
 * - Descarta respuestas viejas si la persona siguió escribiendo.
 * - Se maneja con teclado: flechas para moverse, Enter para elegir, Escape para cerrar.
 * - La tolerancia a errores de tipeo la resuelve la base (función search_products).
 */
export function Buscador() {
  const router = useRouter();
  const idLista = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const ultimaConsulta = useRef(0);

  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ProductoTarjeta[]>([]);
  const [estado, setEstado] = useState<"inactivo" | "cargando" | "listo" | "error">("inactivo");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1); // sugerencia resaltada con las flechas

  const consulta = texto.trim();
  const buscable = consulta.length >= MINIMO_LETRAS;

  // Consulta con espera ("debounce").
  useEffect(() => {
    if (!buscable) {
      setResultados([]);
      setEstado("inactivo");
      return;
    }
    setEstado("cargando");
    const numero = ++ultimaConsulta.current;
    const temporizador = setTimeout(async () => {
      const { data, error } = await createClient()
        .rpc("search_products", { p_query: consulta, p_limit: MAXIMO_SUGERENCIAS })
        .select(COLUMNAS_TARJETA);
      if (numero !== ultimaConsulta.current) return; // llegó tarde: ya hay otra búsqueda
      if (error) {
        setEstado("error");
        return;
      }
      setResultados((data ?? []) as ProductoTarjeta[]);
      setActivo(-1);
      setEstado("listo");
    }, ESPERA_MS);
    return () => clearTimeout(temporizador);
  }, [consulta, buscable]);

  // Cerrar al tocar afuera.
  useEffect(() => {
    function alTocar(evento: PointerEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    }
    document.addEventListener("pointerdown", alTocar);
    return () => document.removeEventListener("pointerdown", alTocar);
  }, []);

  function cerrar() {
    setAbierto(false);
    setActivo(-1);
    input.current?.blur();
  }

  function irAResultados() {
    if (!buscable) return;
    cerrar();
    router.push(`/buscar?q=${encodeURIComponent(consulta)}`);
  }

  function alPresionarTecla(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Escape") {
      setAbierto(false);
      return;
    }
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      if (resultados.length === 0) return;
      evento.preventDefault();
      setAbierto(true);
      const paso = evento.key === "ArrowDown" ? 1 : -1;
      // Recorre -1 (ninguna) → 0 → … → última → -1
      setActivo((i) => ((i + 1 + paso + resultados.length + 1) % (resultados.length + 1)) - 1);
    }
  }

  function alEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    const elegido = resultados[activo];
    if (abierto && elegido) {
      cerrar();
      setTexto("");
      router.push(`/producto/${elegido.slug}`);
    } else {
      irAResultados();
    }
  }

  const mostrarPanel = abierto && buscable;

  return (
    <div ref={contenedor} className="relative w-full">
      <form role="search" onSubmit={alEnviar} className="relative">
        <IconoBuscar
          width={20}
          height={20}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
        />
        <input
          ref={input}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Buscá un producto o una marca"
          aria-label="Buscar productos"
          role="combobox"
          aria-expanded={mostrarPanel}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={activo >= 0 ? `${idLista}-${activo}` : undefined}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alPresionarTecla}
          className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-10 text-base text-neutral-900 placeholder:text-neutral-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        {texto && (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            onClick={() => {
              setTexto("");
              input.current?.focus();
            }}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
          >
            <IconoCerrar width={18} height={18} />
          </button>
        )}
      </form>

      {mostrarPanel && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
          {estado === "cargando" && resultados.length === 0 && (
            <p className="flex items-center gap-2 px-4 py-4 text-sm text-neutral-600">
              <Spinner className="h-4 w-4" /> Buscando…
            </p>
          )}
          {estado === "error" && (
            <p role="alert" className="px-4 py-4 text-sm text-neutral-600">
              No pudimos buscar. Revisá tu conexión y probá de nuevo.
            </p>
          )}
          {estado === "listo" && resultados.length === 0 && (
            <p className="px-4 py-4 text-sm text-neutral-600">
              No encontramos nada para “{consulta}”. Probá con otra palabra.
            </p>
          )}

          <ul id={idLista} role="listbox" aria-label="Sugerencias">
            {resultados.map((producto, i) => (
              <li key={producto.id} id={`${idLista}-${i}`} role="option" aria-selected={i === activo}>
                <Link
                  href={`/producto/${producto.slug}`}
                  onClick={() => {
                    cerrar();
                    setTexto("");
                  }}
                  tabIndex={-1}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 hover:bg-neutral-50",
                    i === activo && "bg-neutral-100",
                  )}
                >
                  <ImagenProducto src={producto.image_url} alt="" sizes="48px" className="w-12 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-neutral-900">{producto.name}</span>
                    {producto.brand && (
                      <span className="block truncate text-xs text-neutral-500">{producto.brand}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm font-semibold">
                    {producto.price > 0 ? formatPrecio(producto.price) : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {resultados.length > 0 && (
            <button
              type="button"
              onClick={irAResultados}
              className="block w-full border-t border-neutral-200 px-4 py-3 text-left text-sm font-medium text-accent hover:bg-neutral-50"
            >
              Ver todos los resultados de “{consulta}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
