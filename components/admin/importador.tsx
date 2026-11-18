"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { importarLote, terminarImportacion } from "@/app/admin/(panel)/importar/acciones";
import { Tarjeta } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import {
  CAMPOS,
  aTabla,
  csvDeEjemplo,
  detectarColumnas,
  leerCsv,
  normalizarFila,
  type Campo,
  type Tabla,
} from "@/lib/importacion";
import { cn } from "@/lib/utils";
import type { ImportResult } from "@/types/database";

const LOTE = 500;
const MAXIMO_ARCHIVO = 20 * 1024 * 1024;
const FILAS_VISTA_PREVIA = 8;

type Paso =
  | { tipo: "elegir" }
  | { tipo: "revisar"; archivo: string; tabla: Tabla }
  | { tipo: "importando"; hechas: number; total: number }
  | { tipo: "listo"; resultado: ImportResult; conErroresPrevios: number };

/**
 * Importación en tres pasos:
 *   1. Elegir el archivo (se lee en el navegador).
 *   2. Revisar qué columna es cada dato y ver una vista previa.
 *   3. Importar de a lotes, con barra de progreso, y ver el resumen.
 */
export function Importador() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>({ tipo: "elegir" });
  const [columnas, setColumnas] = useState<(Campo | null)[]>([]);
  const [crear, setCrear] = useState(true);
  const [error, setError] = useState("");

  async function leerArchivo(archivo: File) {
    setError("");
    if (archivo.size > MAXIMO_ARCHIVO) return setError("El archivo pesa más de 20 MB.");
    const nombre = archivo.name.toLowerCase();
    try {
      let tabla: Tabla;
      if (nombre.endsWith(".xlsx")) {
        const { readSheet } = await import("read-excel-file/universal");
        tabla = aTabla(await readSheet(archivo));
      } else if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) {
        tabla = leerCsv(await archivo.arrayBuffer());
      } else if (nombre.endsWith(".xls")) {
        return setError("Ese es el formato viejo de Excel (.xls). Abrilo y guardalo como .xlsx o .csv.");
      } else {
        return setError("Elegí un archivo .xlsx o .csv.");
      }
      if (!tabla.encabezados.length || !tabla.filas.length) {
        return setError("El archivo está vacío o no tiene filas debajo de los encabezados.");
      }
      setColumnas(detectarColumnas(tabla.encabezados));
      setCrear(true); // cada archivo arranca con la opción por defecto
      setPaso({ tipo: "revisar", archivo: archivo.name, tabla });
    } catch {
      setError("No pudimos leer el archivo. Probá guardarlo de nuevo como .xlsx o .csv.");
    }
  }

  const tabla = paso.tipo === "revisar" ? paso.tabla : null;
  const normalizadas = useMemo(
    () => (tabla ? tabla.filas.map((f, i) => normalizarFila(f, columnas, i + 2)) : []),
    [tabla, columnas],
  );
  const conErrores = normalizadas.filter((n) => n.errores.length > 0);
  const validas = normalizadas.filter((n) => n.errores.length === 0).map((n) => n.fila);
  const tieneCodigo = columnas.includes("sku") || columnas.includes("barcode");

  async function importar() {
    if (!validas.length) return;
    const total = validas.length;
    const acumulado: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
    setPaso({ tipo: "importando", hechas: 0, total });
    for (let i = 0; i < total; i += LOTE) {
      const lote = validas.slice(i, i + LOTE);
      const r = await importarLote(lote, crear).catch(() => ({ ok: false as const, error: "Se cortó la conexión." }));
      if (r.ok) {
        acumulado.created += r.data.created;
        acumulado.updated += r.data.updated;
        acumulado.skipped += r.data.skipped;
        acumulado.errors.push(...r.data.errors);
      } else {
        // Si falla un lote entero, lo informamos fila por fila y seguimos con el próximo.
        acumulado.errors.push(...lote.map((f) => ({ row: f.row, error: r.error })));
      }
      setPaso({ tipo: "importando", hechas: Math.min(i + LOTE, total), total });
    }
    await terminarImportacion();
    setPaso({ tipo: "listo", resultado: acumulado, conErroresPrevios: conErrores.length });
    router.refresh();
  }

  function descargarEjemplo() {
    const url = URL.createObjectURL(new Blob([csvDeEjemplo()], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "productos-ejemplo.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- 1. Elegir ----------
  if (paso.tipo === "elegir") {
    return (
      <Tarjeta className="space-y-4">
        <label
          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 px-4 py-12 text-center hover:bg-neutral-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const archivo = e.dataTransfer.files[0];
            if (archivo) void leerArchivo(archivo);
          }}
        >
          <span className="font-medium">Elegí el archivo o arrastralo acá</span>
          <span className="text-sm text-neutral-600">Excel (.xlsx) o CSV, hasta 20 MB</span>
          <input
            type="file"
            accept=".xlsx,.csv,.txt"
            className="sr-only"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) void leerArchivo(archivo);
              e.target.value = "";
            }}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="button" onClick={descargarEjemplo} className="text-sm text-accent underline underline-offset-2">
          Descargar una planilla de ejemplo
        </button>
      </Tarjeta>
    );
  }

  // ---------- 3. Importando ----------
  if (paso.tipo === "importando") {
    const porcentaje = Math.round((paso.hechas / paso.total) * 100);
    return (
      <Tarjeta className="space-y-3" >
        <p className="font-medium" role="status">
          Importando… {paso.hechas.toLocaleString("es-AR")} de {paso.total.toLocaleString("es-AR")} productos
        </p>
        <div className="h-3 overflow-hidden rounded-full bg-neutral-100" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-accent transition-all" style={{ width: `${porcentaje}%` }} />
        </div>
        <p className="text-sm text-neutral-600">No cierres esta pestaña hasta que termine.</p>
      </Tarjeta>
    );
  }

  // ---------- 4. Listo ----------
  if (paso.tipo === "listo") {
    const { resultado } = paso;
    return (
      <Tarjeta className="space-y-4">
        <h2 className="text-lg font-semibold">Importación terminada</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Numero etiqueta="Creados" valor={resultado.created} />
          <Numero etiqueta="Actualizados" valor={resultado.updated} />
          <Numero etiqueta="No existían (salteados)" valor={resultado.skipped} />
          <Numero etiqueta="Con errores" valor={resultado.errors.length + paso.conErroresPrevios} alerta />
        </dl>
        {resultado.errors.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Filas que no se pudieron guardar:</p>
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {resultado.errors.slice(0, 200).map((e, i) => (
                <li key={i}>
                  Fila {e.row}: {e.error}
                </li>
              ))}
              {resultado.errors.length > 200 && <li>…y {resultado.errors.length - 200} más.</li>}
            </ul>
          </div>
        )}
        <p className="text-sm text-neutral-600">La tienda ya muestra los cambios.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setPaso({ tipo: "elegir" })}>
            Importar otro archivo
          </Button>
          <Button type="button" variante="secundario" onClick={() => router.push("/admin/productos")}>
            Ver productos
          </Button>
        </div>
      </Tarjeta>
    );
  }

  // ---------- 2. Revisar ----------
  const { tabla: t } = paso;
  const usados = columnas.filter(Boolean);
  return (
    <div className="space-y-4">
      <Tarjeta className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            {paso.archivo} · {t.filas.length.toLocaleString("es-AR")} filas
          </h2>
          <button type="button" onClick={() => setPaso({ tipo: "elegir" })} className="text-sm text-neutral-600 underline underline-offset-2">
            Elegir otro archivo
          </button>
        </div>
        <p className="text-sm text-neutral-600">
          Revisá qué dato tiene cada columna. Las que quedan en “No importar” se ignoran.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {t.encabezados.map((encabezado, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <span className="w-40 shrink-0 truncate font-medium" title={encabezado}>
                {encabezado || `Columna ${i + 1}`}
              </span>
              <span aria-hidden className="text-neutral-400">→</span>
              <select
                value={columnas[i] ?? ""}
                onChange={(e) => {
                  const nuevo = (e.target.value || null) as Campo | null;
                  setColumnas((c) => c.map((x, j) => (j === i ? nuevo : x === nuevo && nuevo ? null : x)));
                }}
                className={cn(
                  "h-9 min-w-0 flex-1 rounded-md border bg-white px-2 text-sm",
                  columnas[i] ? "border-accent" : "border-neutral-300 text-neutral-500",
                )}
              >
                <option value="">No importar</option>
                {CAMPOS.map((c) => (
                  <option key={c.campo} value={c.campo} disabled={usados.includes(c.campo) && columnas[i] !== c.campo}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {!tieneCodigo && (
          <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Falta indicar qué columna es el SKU o el código de barras: sin eso no se puede saber qué producto es cada fila.
          </p>
        )}
      </Tarjeta>

      <Tarjeta className="space-y-3">
        <h2 className="font-semibold">Vista previa</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-2 py-1 font-medium">Fila</th>
                <th className="px-2 py-1 font-medium">Código</th>
                <th className="px-2 py-1 font-medium">Nombre</th>
                <th className="px-2 py-1 font-medium">Precio</th>
                <th className="px-2 py-1 font-medium">Stock</th>
                <th className="px-2 py-1 font-medium">Categoría</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {normalizadas.slice(0, FILAS_VISTA_PREVIA).map(({ fila, errores }) => (
                <tr key={fila.row} className={cn(errores.length > 0 && "bg-red-50")}>
                  <td className="px-2 py-1.5 tabular-nums text-neutral-500">{fila.row}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{fila.sku ?? fila.barcode ?? "—"}</td>
                  <td className="px-2 py-1.5">
                    {fila.name ?? <span className="text-neutral-400">sin cambios</span>}
                    {errores.length > 0 && <span className="block text-xs text-red-700">{errores.join(" ")}</span>}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{fila.price !== undefined ? `$ ${fila.price.toLocaleString("es-AR")}` : "—"}</td>
                  <td className="px-2 py-1.5 tabular-nums">{fila.stock !== undefined ? fila.stock.toLocaleString("es-AR") : "—"}</td>
                  <td className="px-2 py-1.5">{[fila.category, fila.subcategory].filter(Boolean).join(" › ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {t.filas.length > FILAS_VISTA_PREVIA && (
          <p className="text-xs text-neutral-500">Se muestran las primeras {FILAS_VISTA_PREVIA} filas.</p>
        )}
      </Tarjeta>

      <Tarjeta className="space-y-4">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={crear} onChange={(e) => setCrear(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[rgb(var(--accent))]" />
          <span>
            Crear los productos que todavía no existen
            <span className="block text-neutral-600">
              Si lo destildás, solo se actualizan los productos que ya están cargados (útil para actualizar precios).
            </span>
          </span>
        </label>

        {conErrores.length > 0 && (
          <details className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <summary className="cursor-pointer font-medium">
              {conErrores.length.toLocaleString("es-AR")} {conErrores.length === 1 ? "fila tiene" : "filas tienen"} errores y no se van a importar
            </summary>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {conErrores.slice(0, 200).map(({ fila, errores }) => (
                <li key={fila.row}>
                  Fila {fila.row}: {errores.join(" ")}
                </li>
              ))}
            </ul>
          </details>
        )}

        <Button type="button" tamano="lg" disabled={!tieneCodigo || validas.length === 0} onClick={importar}>
          Importar {validas.length.toLocaleString("es-AR")} {validas.length === 1 ? "producto" : "productos"}
        </Button>
      </Tarjeta>
    </div>
  );
}

function Numero({ etiqueta, valor, alerta }: { etiqueta: string; valor: number; alerta?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", alerta && valor > 0 ? "border-red-200 bg-red-50" : "border-neutral-200")}>
      <dt className="text-xs text-neutral-600">{etiqueta}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{valor.toLocaleString("es-AR")}</dd>
    </div>
  );
}
