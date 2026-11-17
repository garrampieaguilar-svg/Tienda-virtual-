/**
 * Convierte texto a número aceptando el formato argentino.
 * "1.234,56" → 1234.56 · "1234,5" → 1234.5 · "1234.5" → 1234.5 · "$ 2.500" → 2500
 */
export function aNumero(valor: string): number | null {
  let t = valor.replace(/[^\d.,-]/g, "");
  if (t === "" || t === "-") return null;
  const coma = t.lastIndexOf(",");
  const punto = t.lastIndexOf(".");
  if (coma > -1 && punto > -1) {
    // El que aparece último es el separador decimal.
    t = coma > punto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (coma > -1) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (punto > -1 && /^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, ""); // "2.500" son dos mil quinientos
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
