import type { Metadata } from "next";
import { Importador } from "@/components/admin/importador";
import { Titulo } from "@/components/admin/ui";
import { exigirPersonal } from "@/lib/admin";

export const metadata: Metadata = { title: "Importar productos" };

export default async function PaginaImportar() {
  await exigirPersonal();
  return (
    <div className="mx-auto max-w-4xl">
      <Titulo>Importar productos</Titulo>
      <div className="mb-6 space-y-2 text-sm text-neutral-700">
        <p>
          Subí el archivo que exporta tu sistema de facturación (Excel <strong>.xlsx</strong> o{" "}
          <strong>.csv</strong>). La primera fila tiene que tener los nombres de las columnas.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Cada producto se identifica por su <strong>SKU</strong> (o, si no tiene, por su código de
            barras). Si ya existe, se actualiza; si no, se crea.
          </li>
          <li>Solo se cambian las columnas que trae el archivo: para actualizar precios alcanza con SKU y precio.</li>
          <li>Las categorías y subcategorías que no existan se crean solas.</li>
          <li>Nada se borra: los productos que no vienen en el archivo quedan como están.</li>
        </ul>
      </div>
      <Importador />
    </div>
  );
}
