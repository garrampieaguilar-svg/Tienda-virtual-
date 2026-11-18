/**
 * Importación masiva de productos: lectura del archivo y normalización de filas.
 * Todo esto corre en el navegador (no sube el archivo entero al servidor): al
 * servidor solo viajan las filas ya limpias, en lotes.
 */

import { aNumero } from "@/lib/numeros";
import type { ContentUnit, ImportRow, SaleUnit } from "@/types/database";

export type Campo = Exclude<keyof ImportRow, "row">;

/** Columnas que entiende la importación, con los nombres de encabezado que se reconocen solos. */
export const CAMPOS: { campo: Campo; etiqueta: string; sinonimos: string[] }[] = [
  { campo: "sku", etiqueta: "SKU / código interno", sinonimos: ["sku", "codigo", "cod", "codigointerno", "codinterno", "codigoarticulo", "codart", "id", "idproducto"] },
  { campo: "barcode", etiqueta: "Código de barras", sinonimos: ["codigodebarras", "codigobarras", "codbarras", "codbarra", "barcode", "ean", "ean13", "upc"] },
  { campo: "name", etiqueta: "Nombre", sinonimos: ["nombre", "producto", "articulo", "nombreproducto", "descripcioncorta", "detalle", "name", "titulo"] },
  { campo: "brand", etiqueta: "Marca", sinonimos: ["marca", "brand", "fabricante"] },
  { campo: "description", etiqueta: "Descripción", sinonimos: ["descripcion", "descripcionlarga", "description", "observaciones"] },
  { campo: "category", etiqueta: "Categoría", sinonimos: ["categoria", "rubro", "familia", "seccion", "departamento", "category"] },
  { campo: "subcategory", etiqueta: "Subcategoría", sinonimos: ["subcategoria", "subrubro", "subfamilia", "subcategory"] },
  { campo: "price", etiqueta: "Precio", sinonimos: ["precio", "precioventa", "preciofinal", "pvp", "preciopublico", "price", "precioconiva", "venta"] },
  { campo: "previous_price", etiqueta: "Precio anterior", sinonimos: ["precioanterior", "preciolista", "precioantes", "preciooriginal"] },
  { campo: "on_sale", etiqueta: "En oferta (sí/no)", sinonimos: ["oferta", "enoferta", "promo", "promocion"] },
  { campo: "stock", etiqueta: "Stock", sinonimos: ["stock", "existencia", "existencias", "cantidad", "disponible", "saldo"] },
  { campo: "sale_unit", etiqueta: "Se vende por (unidad, kilo, litro, pack)", sinonimos: ["unidaddeventa", "unidadventa", "seventepor", "sevendepor", "unidad", "um", "unidadmedida"] },
  { campo: "quantity_step", etiqueta: "De a cuánto se suma", sinonimos: ["paso", "fraccion", "multiplo", "incremento"] },
  { campo: "net_content", etiqueta: "Contenido (ej: 500 g)", sinonimos: ["contenido", "contenidoneto", "peso", "volumen", "tamano", "presentacion"] },
  { campo: "net_content_unit", etiqueta: "Unidad del contenido (g, kg, ml, l, un)", sinonimos: ["unidadcontenido", "unidaddecontenido", "unidadpeso"] },
  { campo: "active", etiqueta: "Visible (sí/no)", sinonimos: ["activo", "visible", "publicado", "habilitado", "active"] },
];

/** "Código de Barras" → "codigodebarras" */
export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Para cada columna del archivo, qué campo le corresponde (o null si se ignora). */
export function detectarColumnas(encabezados: string[]): (Campo | null)[] {
  const usados = new Set<Campo>();
  return encabezados.map((e) => {
    const n = normalizarEncabezado(e);
    if (!n) return null;
    const encontrado = CAMPOS.find((c) => !usados.has(c.campo) && c.sinonimos.includes(n));
    if (encontrado) usados.add(encontrado.campo);
    return encontrado?.campo ?? null;
  });
}

// ---------------------------------------------------------------------
// Lectura de archivos
// ---------------------------------------------------------------------

export type Tabla = { encabezados: string[]; filas: string[][] };

/**
 * Lee un CSV. Detecta solo el separador (Excel en castellano usa ";") y la
 * codificación (UTF-8 o la de Windows, que usa Excel al "Guardar como CSV").
 */
export function leerCsv(bytes: ArrayBuffer): Tabla {
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder("windows-1252").decode(bytes);
  }
  texto = texto.replace(/^﻿/, "");

  const primeraLinea = texto.slice(0, texto.search(/\r?\n|$/));
  const candidatos = [";", ",", "\t", "|"];
  const separador = candidatos.reduce((mejor, s) =>
    primeraLinea.split(s).length > primeraLinea.split(mejor).length ? s : mejor,
  );

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          celda += '"';
          i++;
        } else entreComillas = false;
      } else celda += c;
    } else if (c === '"' && celda === "") {
      entreComillas = true;
    } else if (c === separador) {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  if (celda !== "" || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }
  return aTabla(filas);
}

/** Convierte una grilla (de CSV o Excel) en encabezados + filas, sin las filas vacías. */
export function aTabla(grilla: unknown[][]): Tabla {
  const celdas = grilla
    .map((f) => f.map((v) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim())))
    .filter((f) => f.some((v) => v !== ""));
  const [encabezados = [], ...filas] = celdas;
  return { encabezados, filas };
}

// ---------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------

const UNIDADES_VENTA: Record<string, SaleUnit> = {
  unidad: "unidad", unidades: "unidad", un: "unidad", u: "unidad", uni: "unidad", c: "unidad", cu: "unidad",
  kilo: "kilo", kilos: "kilo", kg: "kilo", kgs: "kilo", k: "kilo", granel: "kilo", peso: "kilo",
  litro: "litro", litros: "litro", l: "litro", lt: "litro", lts: "litro",
  pack: "pack", packs: "pack", paquete: "pack", caja: "pack", bulto: "pack",
};

const UNIDADES_CONTENIDO: Record<string, ContentUnit> = {
  g: "g", gr: "g", grs: "g", gramo: "g", gramos: "g",
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg",
  ml: "ml", cc: "ml", cm3: "ml",
  l: "l", lt: "l", lts: "l", litro: "l", litros: "l",
  un: "un", u: "un", unidad: "un", unidades: "un", uds: "un",
};

function aBooleano(valor: string): boolean | null {
  const v = normalizarEncabezado(valor);
  if (["si", "s", "1", "true", "x", "verdadero", "yes", "y", "activo", "visible"].includes(v)) return true;
  if (["no", "n", "0", "false", "falso", "inactivo", "oculto"].includes(v)) return false;
  return null;
}

export type FilaNormalizada = { fila: ImportRow; errores: string[] };

/**
 * Convierte una fila del archivo en lo que espera import_products().
 * Las celdas vacías no viajan: así no se borra lo que ya estaba cargado.
 */
export function normalizarFila(celdas: string[], columnas: (Campo | null)[], numeroFila: number): FilaNormalizada {
  const fila: ImportRow = { row: numeroFila };
  const errores: string[] = [];

  columnas.forEach((campo, i) => {
    const valor = (celdas[i] ?? "").trim();
    if (!campo || valor === "") return;

    switch (campo) {
      case "sku":
      case "barcode": {
        // Excel a veces convierte códigos largos en "7,79E+12": eso ya no se puede recuperar.
        if (/^\d+([.,]\d+)?e\+?\d+$/i.test(valor)) {
          errores.push("El código está en formato científico (7,79E+12). En Excel, poné esa columna como Texto.");
          return;
        }
        fila[campo] = valor.replace(/\.0+$/, "").slice(0, 60);
        return;
      }
      case "name":
        fila.name = valor.slice(0, 200);
        return;
      case "brand":
      case "category":
      case "subcategory":
        fila[campo] = valor.slice(0, 120);
        return;
      case "description":
        fila.description = valor.slice(0, 4000);
        return;
      case "price":
      case "previous_price":
      case "stock":
      case "quantity_step": {
        const n = aNumero(valor);
        if (n === null || n < 0) {
          errores.push(`“${valor}” no es un número válido.`);
          return;
        }
        if (campo === "quantity_step" && n === 0) {
          errores.push("“De a cuánto se suma” no puede ser 0.");
          return;
        }
        fila[campo] = n;
        return;
      }
      case "on_sale":
      case "active": {
        const b = aBooleano(valor);
        if (b === null) errores.push(`“${valor}”: usá sí o no.`);
        else fila[campo] = b;
        return;
      }
      case "sale_unit": {
        const u = UNIDADES_VENTA[normalizarEncabezado(valor)];
        if (!u) errores.push(`Unidad de venta “${valor}” desconocida (usá unidad, kilo, litro o pack).`);
        else fila.sale_unit = u;
        return;
      }
      case "net_content_unit": {
        const u = UNIDADES_CONTENIDO[normalizarEncabezado(valor)];
        if (!u) errores.push(`Unidad “${valor}” desconocida (usá g, kg, ml, l o un).`);
        else fila.net_content_unit = u;
        return;
      }
      case "net_content": {
        // Acepta "500", "500 g", "1,5 L", "2.25lts".
        const m = valor.match(/^([\d.,]+)\s*([a-zA-Z³]*)$/);
        const n = m ? aNumero(m[1]) : null;
        if (!m || n === null || n <= 0) {
          errores.push(`Contenido “${valor}” no válido (ej: 500 g).`);
          return;
        }
        fila.net_content = n;
        if (m[2]) {
          const u = UNIDADES_CONTENIDO[normalizarEncabezado(m[2])];
          if (u) fila.net_content_unit = u;
          else errores.push(`Unidad “${m[2]}” desconocida (usá g, kg, ml, l o un).`);
        }
        return;
      }
    }
  });

  if (!fila.sku && !fila.barcode) errores.push("Falta el código (SKU o código de barras).");
  // Productos por kilo: si no dicen de a cuánto se suman, de a 250 g.
  if (fila.sale_unit === "kilo" && fila.quantity_step === undefined && !columnas.includes("quantity_step")) {
    fila.quantity_step = 0.25;
  }
  return { fila, errores };
}

/** Planilla de ejemplo para descargar. */
export function csvDeEjemplo(): string {
  const filas = [
    ["sku", "codigo_de_barras", "nombre", "marca", "categoria", "subcategoria", "precio", "precio_anterior", "oferta", "stock", "unidad", "contenido", "visible"],
    ["A0001", "7790000000011", "Yerba mate suave", "Don Mateo", "Almacén", "Yerba, café y té", "2400", "3000", "sí", "40", "unidad", "500 g", "sí"],
    ["F0001", "", "Banana", "", "Frescos", "Frutas y verduras", "1800", "", "no", "60", "kilo", "", "sí"],
  ];
  return "﻿" + filas.map((f) => f.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n");
}
