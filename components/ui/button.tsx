import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

type Variante = "primario" | "secundario" | "fantasma" | "peligro";
type Tamano = "sm" | "md" | "lg" | "icono";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  /** Muestra un spinner y deshabilita el botón. */
  cargando?: boolean;
}

const estilosVariante: Record<Variante, string> = {
  primario: "bg-accent text-accent-fg hover:bg-accent-hover",
  secundario: "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50",
  fantasma: "text-neutral-700 hover:bg-neutral-100",
  peligro: "bg-red-700 text-white hover:bg-red-800",
};

const estilosTamano: Record<Tamano, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  // Botones solo con ícono: 40x40 mínimo, buen tamaño para el dedo en el celular.
  icono: "h-10 w-10",
};

/**
 * Botón base del sitio. Si es solo un ícono, acordate de pasarle aria-label.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variante = "primario", tamano = "md", cargando, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        estilosVariante[variante],
        estilosTamano[tamano],
        className,
      )}
      {...props}
    >
      {cargando && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});
