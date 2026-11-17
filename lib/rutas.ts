/**
 * Devuelve una ruta interna segura para redirigir después del login.
 * Solo acepta rutas del propio sitio ("/cuenta"): así nadie puede armar un link
 * de ingreso que termine mandando a la gente a otra página.
 */
export function rutaSegura(valor: string | null | undefined, porDefecto = "/cuenta"): string {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) {
    return porDefecto;
  }
  return valor;
}
