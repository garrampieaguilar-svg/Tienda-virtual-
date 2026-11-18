"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECCIONES = [
  { href: "/admin", texto: "Pedidos", soloAdmin: false },
  { href: "/admin/productos", texto: "Productos", soloAdmin: false },
  { href: "/admin/categorias", texto: "Categorías", soloAdmin: false },
  { href: "/admin/importar", texto: "Importar", soloAdmin: false },
  { href: "/admin/configuracion", texto: "Configuración", soloAdmin: true },
  { href: "/admin/usuarios", texto: "Usuarios", soloAdmin: true },
];

/** Pestañas del panel. En el celular se deslizan de costado. */
export function NavPanel({ esAdmin }: { esAdmin: boolean }) {
  const ruta = usePathname();
  const activa = (href: string) =>
    href === "/admin" ? ruta === "/admin" || ruta.startsWith("/admin/pedidos") : ruta.startsWith(href);

  return (
    <nav aria-label="Secciones del panel" className="mx-auto max-w-6xl">
      <ul className="no-scrollbar flex gap-1 overflow-x-auto px-4">
        {SECCIONES.filter((s) => esAdmin || !s.soloAdmin).map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              aria-current={activa(s.href) ? "page" : undefined}
              className={cn(
                "block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium",
                activa(s.href)
                  ? "border-accent text-accent"
                  : "border-transparent text-neutral-600 hover:text-neutral-900",
              )}
            >
              {s.texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
