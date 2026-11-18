import Link from "next/link";
import { EstadoVacio } from "@/components/ui/estado-vacio";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-content px-4">
      <EstadoVacio
        titulo="No encontramos esta página"
        descripcion="Puede que el link esté mal escrito o que el producto ya no esté disponible."
        accion={
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover"
          >
            Volver al inicio
          </Link>
        }
      />
    </main>
  );
}
