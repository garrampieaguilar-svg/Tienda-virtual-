"use client";

import { useState, type FormEvent } from "react";
import { guardarPerfil } from "@/app/(tienda)/cuenta/acciones";
import { Button } from "@/components/ui/button";
import { IconoCheck } from "@/components/ui/iconos";
import { Campo, Input } from "@/components/ui/input";

type Datos = { nombre: string; telefono: string; direccion: string; referencias: string };

/** Datos de contacto y entrega guardados en la cuenta. */
export function FormularioPerfil({ inicial }: { inicial: Datos }) {
  const [datos, setDatos] = useState<Datos>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  const cambiar = (campo: keyof Datos) => (ev: React.ChangeEvent<HTMLInputElement>) => {
    setDatos((d) => ({ ...d, [campo]: ev.target.value }));
    setGuardado(false);
  };

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const formData = new FormData();
      for (const [campo, valor] of Object.entries(datos)) formData.set(campo, valor);
      const resultado = await guardarPerfil(formData);
      if (resultado.ok) setGuardado(true);
      else setError(resultado.error);
    } catch {
      setError("No pudimos guardar tus datos. Revisá tu conexión y probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} noValidate className="space-y-4">
      <Campo label="Nombre y apellido">
        {(p) => (
          <Input {...p} value={datos.nombre} onChange={cambiar("nombre")} autoComplete="name" maxLength={120} />
        )}
      </Campo>
      <Campo label="Teléfono (WhatsApp)">
        {(p) => (
          <Input
            {...p}
            value={datos.telefono}
            onChange={cambiar("telefono")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
          />
        )}
      </Campo>
      <Campo label="Dirección" opcional>
        {(p) => (
          <Input
            {...p}
            value={datos.direccion}
            onChange={cambiar("direccion")}
            autoComplete="street-address"
            placeholder="Calle y número"
            maxLength={300}
          />
        )}
      </Campo>
      <Campo label="Piso, departamento o referencias" opcional>
        {(p) => (
          <Input {...p} value={datos.referencias} onChange={cambiar("referencias")} maxLength={300} />
        )}
      </Campo>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <Button type="submit" cargando={guardando}>
          Guardar
        </Button>
        {guardado && (
          <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-accent">
            <IconoCheck width={18} height={18} />
            Guardado
          </p>
        )}
      </div>
    </form>
  );
}
