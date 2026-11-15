import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Foto del producto, cuadrada. Si el producto no tiene imagen, muestra el placeholder.
 * `sizes` le dice a next/image qué ancho ocupa en pantalla para bajar el tamaño justo.
 */
export function ImagenProducto({
  src,
  alt,
  sizes,
  prioridad,
  className,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  /** true solo para la imagen principal de la página (se carga primero). */
  prioridad?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-square overflow-hidden rounded-lg bg-neutral-100", className)}>
      <Image
        src={src || "/placeholder-producto.svg"}
        alt={alt}
        fill
        sizes={sizes}
        priority={prioridad}
        className="object-contain"
      />
    </div>
  );
}
