import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SelectorRol } from "@/components/admin/selector-rol";
import { Titulo } from "@/components/admin/ui";
import { exigirPersonal } from "@/lib/admin";
import { ZONA_HORARIA } from "@/lib/pedido";

export const metadata: Metadata = { title: "Usuarios" };

const formatoDia = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA_HORARIA, dateStyle: "medium" });

type Props = { searchParams: { q?: string } };

export default async function PaginaUsuarios({ searchParams }: Props) {
  const { sb, rol, userId } = await exigirPersonal();
  if (rol !== "admin") redirect("/admin");
  const { data, error } = await sb.rpc("admin_users");
  if (error) throw new Error(`No se pudieron leer los usuarios: ${error.message}`);

  const q = (searchParams.q ?? "").trim().toLowerCase();
  const usuarios = (data ?? []).filter(
    (u) => !q || u.email.toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Titulo>Usuarios</Titulo>
      <div className="mb-4 space-y-1 text-sm text-neutral-600">
        <p>
          Para sumar a alguien al equipo: que ingrese una vez a la tienda con su email (botón de la
          cuenta, arriba a la derecha) y después cambiale el rol acá.
        </p>
        <p>
          <strong className="font-medium text-neutral-800">Empleado:</strong> ve y atiende pedidos,
          carga productos y categorías. <strong className="font-medium text-neutral-800">Administrador:</strong>{" "}
          además cambia la configuración y los roles.
        </p>
      </div>
      <form action="/admin/usuarios" className="mb-4 flex gap-2">
        <label htmlFor="buscar-usuario" className="sr-only">
          Buscar usuario
        </label>
        <input id="buscar-usuario" name="q" defaultValue={q} placeholder="Email o nombre" className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm sm:w-72" />
        <button type="submit" className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm hover:bg-neutral-50">
          Buscar
        </button>
      </form>
      {usuarios.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-12 text-center text-neutral-600">
          No hay usuarios{q ? " que coincidan" : ""}.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {usuarios.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.full_name || u.email}</p>
                <p className="truncate text-sm text-neutral-600">
                  {u.full_name ? `${u.email} · ` : ""}desde {formatoDia.format(new Date(u.created_at))}
                </p>
              </div>
              {u.id === userId ? (
                <span className="text-sm text-neutral-600">Vos (administrador)</span>
              ) : (
                <SelectorRol id={u.id} rol={u.role} email={u.email} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
