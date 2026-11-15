/**
 * Une clases de Tailwind ignorando valores falsos.
 * Ej: cn("px-2", activo && "bg-accent") → "px-2 bg-accent"
 * (Versión mínima a propósito, para no sumar dependencias.)
 */
export function cn(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(" ");
}

/**
 * Convierte un texto en slug para URLs: "Lácteos y Huevos" → "lacteos-y-huevos".
 */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
