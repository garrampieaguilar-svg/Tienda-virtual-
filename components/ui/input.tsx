import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const estiloCampo =
  "block w-full rounded-lg border border-neutral-300 bg-white px-3 text-base text-neutral-900 " +
  "placeholder:text-neutral-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 " +
  "disabled:bg-neutral-50 disabled:text-neutral-500 aria-[invalid=true]:border-red-600";
// Nota: text-base (16px) evita que iOS haga zoom al enfocar el campo.

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(estiloCampo, "h-11", className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(estiloCampo, "min-h-24 py-2", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(estiloCampo, "h-11 pr-8", className)} {...props}>
        {children}
      </select>
    );
  },
);

interface CampoProps {
  label: string;
  /** Mensaje de error de validación (se anuncia a lectores de pantalla). */
  error?: string;
  /** Texto de ayuda debajo del campo. */
  ayuda?: string;
  opcional?: boolean;
  /** Recibe el id para vincular label, campo y mensajes. */
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}

/**
 * Envoltorio de formulario: label + campo + ayuda + error, todo bien vinculado
 * para accesibilidad.
 *
 * <Campo label="Teléfono" error={errors.telefono?.message}>
 *   {(p) => <Input {...p} {...register("telefono")} />}
 * </Campo>
 */
export function Campo({ label, error, ayuda, opcional, children }: CampoProps) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const describedBy = [ayuda && idAyuda, error && idError].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-neutral-800">
        {label}
        {opcional && <span className="ml-1 font-normal text-neutral-500">(opcional)</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {ayuda && !error && (
        <p id={idAyuda} className="text-sm text-neutral-600">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
