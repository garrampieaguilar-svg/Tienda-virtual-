import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Piezas chicas de interfaz que se repiten en el panel. */

export function Titulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold tracking-tight">{children}</h1>
      {accion}
    </div>
  );
}

export function Tarjeta({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-lg border border-neutral-200 bg-white p-4", className)}>{children}</section>;
}

export const estiloBotonLink =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors";

export function BotonLink({
  href,
  variante = "primario",
  children,
}: {
  href: string;
  variante?: "primario" | "secundario";
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        estiloBotonLink,
        variante === "primario"
          ? "bg-accent text-accent-fg hover:bg-accent-hover"
          : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50",
      )}
    >
      {children}
    </Link>
  );
}

/** Paginación simple: « Anterior · Página 2 de 7 · Siguiente » conservando los filtros. */
export function Paginacion({
  pagina,
  total,
  porPagina,
  armarHref,
}: {
  pagina: number;
  total: number;
  porPagina: number;
  armarHref: (pagina: number) => string;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  const estilo = "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50";
  return (
    <nav aria-label="Páginas" className="mt-4 flex items-center justify-between gap-3 text-sm">
      {pagina > 1 ? (
        <Link href={armarHref(pagina - 1)} className={estilo}>
          ‹ Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-neutral-600">
        Página {pagina} de {paginas}
      </span>
      {pagina < paginas ? (
        <Link href={armarHref(pagina + 1)} className={estilo}>
          Siguiente ›
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
