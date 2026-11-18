/**
 * Formatos de precios y unidades, en pesos argentinos.
 */

import type { ContentUnit, SaleUnit } from "@/types/database";

const formatoPesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 1234.5 → "$ 1.234,5" */
export function formatPrecio(valor: number): string {
  return formatoPesos.format(valor);
}

export type UnidadVenta = SaleUnit;
export type UnidadContenido = ContentUnit;

/**
 * Calcula el precio por kilo o por litro a partir del contenido neto.
 * Ej: yerba de 500 g a $3.000 → "$ 6.000 / kg".
 * Devuelve null si no aplica (sin precio, sin contenido, o se vende por unidad suelta).
 */
export function precioPorUnidadDeMedida(
  precio: number,
  contenido: number | null | undefined,
  unidadContenido: UnidadContenido | null | undefined,
  unidadVenta: UnidadVenta = "unidad",
): string | null {
  if (!precio || precio <= 0) return null;

  // Productos que ya se venden por kilo o litro: el precio ES el precio por medida.
  if (unidadVenta === "kilo") return `${formatPrecio(precio)} / kg`;
  if (unidadVenta === "litro") return `${formatPrecio(precio)} / l`;

  if (!contenido || contenido <= 0 || !unidadContenido) return null;

  switch (unidadContenido) {
    case "g":
      return `${formatPrecio((precio / contenido) * 1000)} / kg`;
    case "kg":
      return `${formatPrecio(precio / contenido)} / kg`;
    case "ml":
      return `${formatPrecio((precio / contenido) * 1000)} / l`;
    case "l":
      return `${formatPrecio(precio / contenido)} / l`;
    default:
      return null;
  }
}

/** 500, "g" → "500 g" ; 1.5, "l" → "1,5 l" */
export function formatContenido(
  contenido: number | null | undefined,
  unidad: UnidadContenido | null | undefined,
): string | null {
  if (!contenido || !unidad) return null;
  const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(
    contenido,
  );
  return `${numero} ${unidad}`;
}

/** Porcentaje de descuento redondeado: (1000, 800) → 20 */
export function porcentajeDescuento(anterior: number, actual: number): number {
  if (!anterior || anterior <= actual) return 0;
  return Math.round(((anterior - actual) / anterior) * 100);
}

/**
 * Cantidad lista para mostrar según cómo se vende el producto:
 * (2, "unidad") → "2" · (0.5, "kilo") → "500 g" · (1.25, "kilo") → "1,25 kg" · (2, "litro") → "2 l"
 */
export function formatCantidad(cantidad: number, unidadVenta: SaleUnit): string {
  const numero = (n: number) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n);
  if (unidadVenta === "kilo") {
    return cantidad < 1 ? `${numero(cantidad * 1000)} g` : `${numero(cantidad)} kg`;
  }
  if (unidadVenta === "litro") return `${numero(cantidad)} l`;
  return numero(cantidad);
}
