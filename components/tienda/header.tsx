import Image from "next/image";
import Link from "next/link";
import { BotonCarrito } from "./boton-carrito";
import { Buscador } from "./buscador";

/**
 * Barra superior fija: logo, buscador y carrito.
 * En celular el buscador baja a una segunda fila para tener todo el ancho.
 */
export function Header({ nombre, logoUrl }: { nombre: string; logoUrl: string | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:flex-nowrap sm:py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2 rounded-lg" aria-label={`${nombre}, ir al inicio`}>
          {logoUrl ? (
            <Image src={logoUrl} alt="" width={160} height={40} className="h-9 w-auto object-contain" priority />
          ) : (
            <span className="truncate text-lg font-semibold tracking-tight text-neutral-900">{nombre}</span>
          )}
        </Link>

        <div className="order-3 w-full sm:order-2 sm:mx-auto sm:max-w-xl sm:flex-1">
          <Buscador />
        </div>

        <div className="order-2 ml-auto flex items-center sm:order-3 sm:ml-0">
          <BotonCarrito />
        </div>
      </div>
    </header>
  );
}
