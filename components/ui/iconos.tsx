import type { SVGProps } from "react";

/**
 * Íconos del sitio como SVG propios (sin librería de íconos).
 * Son decorativos: el texto accesible va en el botón o link que los contiene.
 */
function Base({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconoBuscar = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
);

export const IconoCarrito = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M6 7h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
    <path d="M9 7V6a3 3 0 0 1 6 0v1" />
  </Base>
);

export const IconoMas = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconoMenos = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M5 12h14" />
  </Base>
);

export const IconoCerrar = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const IconoFlecha = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m9 6 6 6-6 6" />
  </Base>
);

export const IconoBasura = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </Base>
);

export const IconoCheck = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
);

export const IconoCopiar = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Base>
);

/** Globo de chat, para los botones de WhatsApp. */
export const IconoWhatsapp = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 20l1.3-3.9A8 8 0 1 1 8.1 19z" />
    <path d="M9 10.5c.3 1.7 1.800 3.200 3.500 3.500" />
  </Base>
);
