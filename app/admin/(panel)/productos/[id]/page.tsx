import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioProducto } from "@/components/admin/formulario-producto";
import { exigirPersonal } from "@/lib/admin";
import { esUuid } from "@/lib/pedido";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: params.id === "nuevo" ? "Nuevo producto" : "Editar producto" };
}

/** Alta (/admin/productos/nuevo) y edición (/admin/productos/<id>) de un producto. */
export default async function PaginaProducto({ params }: Props) {
  const nuevo = params.id === "nuevo";
  if (!nuevo && !esUuid(params.id)) notFound();
  const { sb } = await exigirPersonal();

  const [producto, categorias] = await Promise.all([
    nuevo ? Promise.resolve({ data: null, error: null }) : sb.from("products").select("*").eq("id", params.id).maybeSingle(),
    sb.from("categories").select("id, name, parent_id, sort_order, active").order("sort_order").order("name"),
  ]);
  if (producto.error || categorias.error) throw new Error("No se pudo leer el producto.");
  if (!nuevo && !producto.data) notFound();

  // Opciones del selector: "Almacén" y debajo "Almacén › Yerba, café y té".
  const todas = categorias.data ?? [];
  const opciones = todas
    .filter((c) => !c.parent_id)
    .flatMap((c) => [
      { id: c.id, texto: c.name + (c.active ? "" : " (oculta)") },
      ...todas
        .filter((h) => h.parent_id === c.id)
        .map((h) => ({ id: h.id, texto: `${c.name} › ${h.name}${h.active ? "" : " (oculta)"}` })),
    ]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/productos" className="rounded text-sm text-neutral-600 hover:underline">
        ‹ Productos
      </Link>
      <h1 className="mb-5 mt-2 text-xl font-semibold tracking-tight">
        {nuevo ? "Nuevo producto" : producto.data!.name}
      </h1>
      <FormularioProducto producto={producto.data} categorias={opciones} />
    </div>
  );
}
