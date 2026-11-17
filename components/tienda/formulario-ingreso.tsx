"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/**
 * Ingreso sin contraseña:
 *   1. La persona escribe su email y le llega un mail con un link (y un código).
 *   2. Abre el link, o escribe el código acá mismo.
 * La primera vez, la cuenta se crea sola.
 */
export function FormularioIngreso({
  destino,
  conGoogle,
  errorInicial,
}: {
  /** A dónde ir después de ingresar. */
  destino: string;
  conGoogle: boolean;
  errorInicial?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [paso, setPaso] = useState<"email" | "codigo">("email");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(errorInicial ?? "");

  const vuelta = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`;

  async function pedirLink(evento: FormEvent) {
    evento.preventDefault();
    const correo = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(correo)) {
      setError("Revisá el email.");
      return;
    }
    setCargando(true);
    setError("");
    const { error: fallo } = await createClient().auth.signInWithOtp({
      email: correo,
      options: { emailRedirectTo: vuelta() },
    });
    setCargando(false);
    if (fallo) {
      setError(
        fallo.status === 429
          ? "Pediste varios links seguidos. Esperá un minuto y probá de nuevo."
          : "No pudimos mandarte el mail. Probá de nuevo en un momento.",
      );
      return;
    }
    setEmail(correo);
    setPaso("codigo");
  }

  async function validarCodigo(evento: FormEvent) {
    evento.preventDefault();
    const token = codigo.replace(/\D/g, "");
    if (token.length < 6) {
      setError("Escribí el código completo que te llegó por mail.");
      return;
    }
    setCargando(true);
    setError("");
    const { error: fallo } = await createClient().auth.verifyOtp({ email, token, type: "email" });
    if (fallo) {
      setCargando(false);
      setError("El código no es correcto o ya venció. Revisalo o pedí uno nuevo.");
      return;
    }
    router.replace(destino);
    router.refresh();
  }

  async function entrarConGoogle() {
    setCargando(true);
    setError("");
    const { error: fallo } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: vuelta() },
    });
    if (fallo) {
      setCargando(false);
      setError("No pudimos abrir el ingreso con Google. Probá con tu email.");
    }
  }

  if (paso === "codigo") {
    return (
      <form onSubmit={validarCodigo} noValidate className="space-y-4">
        <div role="status" className="space-y-1 rounded-lg bg-accent-soft p-4 text-sm text-neutral-800">
          <p className="font-medium">Revisá tu correo</p>
          <p>
            Te mandamos un mail a <strong className="break-all font-semibold">{email}</strong>.
            Abrí el link en este mismo dispositivo, o escribí acá el código que trae.
          </p>
        </div>
        <Campo label="Código" error={error || undefined} ayuda="Si no lo ves, mirá en spam.">
          {(p) => (
            <Input
              {...p}
              value={codigo}
              onChange={(ev) => setCodigo(ev.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              className="tracking-widest"
            />
          )}
        </Campo>
        <Button type="submit" tamano="lg" cargando={cargando} className="w-full">
          Ingresar
        </Button>
        <button
          type="button"
          onClick={() => {
            setPaso("email");
            setCodigo("");
            setError("");
          }}
          className="block w-full rounded text-center text-sm text-neutral-600 underline underline-offset-2"
        >
          Usar otro email o pedir un link nuevo
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={pedirLink} noValidate className="space-y-4">
        <Campo label="Tu email" error={error || undefined}>
          {(p) => (
            <Input
              {...p}
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={200}
            />
          )}
        </Campo>
        <Button type="submit" tamano="lg" cargando={cargando} className="w-full">
          Mandame el link para entrar
        </Button>
      </form>

      {conGoogle && (
        <>
          <p className="flex items-center gap-3 text-sm text-neutral-500" aria-hidden>
            <span className="h-px flex-1 bg-neutral-200" />o<span className="h-px flex-1 bg-neutral-200" />
          </p>
          <Button
            type="button"
            variante="secundario"
            tamano="lg"
            onClick={entrarConGoogle}
            disabled={cargando}
            className="w-full"
          >
            Continuar con Google
          </Button>
        </>
      )}
    </div>
  );
}
