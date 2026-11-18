"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";

/**
 * Pantalla de error general. Next.js la muestra si algo falla al renderizar
 * una página (por ejemplo, si no responde la base de datos).
 */
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-content px-4">
      <EstadoVacio
        titulo="Uy, algo salió mal"
        descripcion="No pudimos cargar esta página. Probá de nuevo en unos segundos."
        accion={<Button onClick={reset}>Reintentar</Button>}
      />
    </main>
  );
}
