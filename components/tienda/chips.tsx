import Link from "next/link";
import { cn } from "@/lib/utils";

export type Chip = { href: string; texto: string; activo?: boolean };

/**
 * Fila de "chips" con scroll horizontal (categorías y subcategorías).
 * Cómoda para el pulgar en el celular; en escritorio simplemente entran todos.
 */
export function Chips({ items, etiqueta }: { items: Chip[]; etiqueta: string }) {
  return (
    <nav aria-label={etiqueta} className="-mx-4 overflow-x-auto px-4 no-scrollbar">
      <ul className="flex w-max gap-2 py-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.activo ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center whitespace-nowrap rounded-full border px-4 text-sm transition-colors",
                item.activo
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-neutral-300 text-neutral-800 hover:bg-neutral-100",
              )}
            >
              {item.texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
