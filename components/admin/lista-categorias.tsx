"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  borrarCategoria,
  crearCategoria,
  editarCategoria,
  moverCategoria,
} from "@/app/admin/(panel)/categorias/acciones";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Nodo = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  productos: number;
  hijas: Nodo[];
};

/** Árbol de categorías editable: renombrar, ordenar, ocultar, borrar y agregar. */
export function ListaCategorias({ arbol }: { arbol: Nodo[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function correr(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setOcupado(true);
    setError("");
    const r = await accion();
    setOcupado(false);
    if (!r.ok) setError(r.error ?? "Algo salió mal.");
    else router.refresh();
    return r.ok;
  }

  return (
    <div className="space-y-4" aria-busy={ocupado}>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {arbol.map((c, i) => (
          <li key={c.id} className="rounded-lg border border-neutral-200 bg-white">
            <Fila nodo={c} primera={i === 0} ultima={i === arbol.length - 1} correr={correr} />
            <ul className="border-t border-neutral-100">
              {c.hijas.map((h, j) => (
                <li key={h.id} className="border-b border-neutral-100 pl-6 last:border-b-0">
                  <Fila nodo={h} primera={j === 0} ultima={j === c.hijas.length - 1} correr={correr} />
                </li>
              ))}
              <li className="pl-6">
                <Agregar padre={c.id} texto="Agregar subcategoría" correr={correr} />
              </li>
            </ul>
          </li>
        ))}
      </ul>
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white">
        <Agregar padre={null} texto="Agregar categoría" correr={correr} />
      </div>
    </div>
  );
}

function Fila({
  nodo,
  primera,
  ultima,
  correr,
}: {
  nodo: Nodo;
  primera: boolean;
  ultima: boolean;
  correr: (a: () => Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(nodo.name);
  const boton = "flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 disabled:opacity-30";

  return (
    <div className={cn("flex flex-wrap items-center gap-2 px-3 py-2", !nodo.active && "text-neutral-500")}>
      {editando ? (
        <form
          className="flex flex-1 gap-2"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            if (await correr(() => editarCategoria(nodo.id, { name: nombre }))) setEditando(false);
          }}
        >
          <label className="sr-only" htmlFor={`nombre-${nodo.id}`}>
            Nombre
          </label>
          <input
            id={`nombre-${nodo.id}`}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            maxLength={80}
            className="h-9 min-w-0 flex-1 rounded-md border border-neutral-300 px-2 text-sm"
          />
          <Button type="submit" tamano="sm">
            Guardar
          </Button>
          <Button type="button" tamano="sm" variante="fantasma" onClick={() => (setEditando(false), setNombre(nodo.name))}>
            Cancelar
          </Button>
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {nodo.name}
              {!nodo.active && <span className="ml-2 text-xs font-normal">(oculta)</span>}
            </p>
            <p className="text-xs text-neutral-500">
              {nodo.productos} {nodo.productos === 1 ? "producto" : "productos"} · /categoria/{nodo.slug}
            </p>
          </div>
          <div className="flex items-center">
            <button type="button" aria-label={`Subir ${nodo.name}`} disabled={primera} className={boton} onClick={() => correr(() => moverCategoria(nodo.id, "arriba"))}>
              ↑
            </button>
            <button type="button" aria-label={`Bajar ${nodo.name}`} disabled={ultima} className={boton} onClick={() => correr(() => moverCategoria(nodo.id, "abajo"))}>
              ↓
            </button>
            <Button type="button" tamano="sm" variante="fantasma" onClick={() => setEditando(true)}>
              Renombrar
            </Button>
            <Button type="button" tamano="sm" variante="fantasma" onClick={() => correr(() => editarCategoria(nodo.id, { active: !nodo.active }))}>
              {nodo.active ? "Ocultar" : "Mostrar"}
            </Button>
            <Button
              type="button"
              tamano="sm"
              variante="fantasma"
              className="text-red-700"
              onClick={() => {
                const aviso = nodo.productos
                  ? `¿Borrar “${nodo.name}”? Sus ${nodo.productos} productos quedan sin categoría (no se borran).`
                  : `¿Borrar “${nodo.name}”?`;
                if (window.confirm(aviso)) void correr(() => borrarCategoria(nodo.id));
              }}
            >
              Borrar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Agregar({
  padre,
  texto,
  correr,
}: {
  padre: string | null;
  texto: string;
  correr: (a: () => Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-accent hover:bg-neutral-50">
        + {texto}
      </button>
    );
  }
  return (
    <form
      className="flex gap-2 px-3 py-2"
      onSubmit={async (e: FormEvent) => {
        e.preventDefault();
        if (await correr(() => crearCategoria(nombre, padre))) {
          setNombre("");
          setAbierto(false);
        }
      }}
    >
      <label className="sr-only" htmlFor={`nueva-${padre ?? "raiz"}`}>
        Nombre
      </label>
      <input
        id={`nueva-${padre ?? "raiz"}`}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        autoFocus
        placeholder="Nombre"
        maxLength={80}
        className="h-9 min-w-0 flex-1 rounded-md border border-neutral-300 px-2 text-sm"
      />
      <Button type="submit" tamano="sm">
        Agregar
      </Button>
      <Button type="button" tamano="sm" variante="fantasma" onClick={() => setAbierto(false)}>
        Cancelar
      </Button>
    </form>
  );
}
