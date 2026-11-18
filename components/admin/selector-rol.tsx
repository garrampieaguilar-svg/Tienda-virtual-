"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cambiarRol } from "@/app/admin/(panel)/usuarios/acciones";
import type { UserRole } from "@/types/database";

const ETIQUETA: Record<UserRole, string> = { customer: "Cliente", employee: "Empleado", admin: "Administrador" };

export function SelectorRol({ id, rol, email }: { id: string; rol: UserRole; email: string }) {
  const router = useRouter();
  const [valor, setValor] = useState(rol);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function cambiar(nuevo: UserRole) {
    if (nuevo === "admin" && !window.confirm(`¿Hacer administrador a ${email}? Va a poder cambiar todo, incluso los roles.`)) return;
    const anterior = valor;
    setValor(nuevo);
    setOcupado(true);
    setError("");
    const r = await cambiarRol(id, nuevo);
    setOcupado(false);
    if (!r.ok) {
      setValor(anterior);
      setError(r.error);
    } else router.refresh();
  }

  return (
    <div className="text-right">
      <select
        aria-label={`Rol de ${email}`}
        value={valor}
        disabled={ocupado}
        onChange={(e) => cambiar(e.target.value as UserRole)}
        className="h-10 rounded-lg border border-neutral-300 bg-white px-2 text-sm"
      >
        {(Object.keys(ETIQUETA) as UserRole[]).map((r) => (
          <option key={r} value={r}>
            {ETIQUETA[r]}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
