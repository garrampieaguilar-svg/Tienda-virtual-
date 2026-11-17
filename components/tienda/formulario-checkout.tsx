"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { crearPedido } from "@/app/(tienda)/checkout/acciones";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Campo, Input, Select, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { formatCantidad, formatPrecio } from "@/lib/format";
import {
  COMPROBANTE_MAX_BYTES,
  COMPROBANTE_TIPOS,
  calcularEnvio,
  diasDisponibles,
  etiquetaFranja,
  formatFecha,
  franjasDelDia,
  pideHorario,
  telefonoValido,
} from "@/lib/pedido";
import { problemaDelItem, useCarritoAlDia } from "@/lib/use-carrito-al-dia";
import { cn } from "@/lib/utils";
import { calcularSubtotal, useCarrito } from "@/store/carrito";
import type {
  CreateOrderInput,
  DeliveryMode,
  DeliveryZone,
  PaymentMethod,
  Settings,
  TimeSlot,
} from "@/types/database";

/** Datos de contacto que recordamos en este navegador para la próxima compra. */
const CLAVE_DATOS = "datos-cliente-v1";
type DatosGuardados = {
  nombre?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  referencias?: string;
};

type Errores = Partial<
  Record<
    | "nombre"
    | "telefono"
    | "email"
    | "direccion"
    | "zona"
    | "fecha"
    | "franja"
    | "pagaCon"
    | "comprobante",
    string
  >
>;

const estiloLink =
  "inline-flex h-12 items-center justify-center rounded-lg bg-accent px-6 text-base font-medium text-accent-fg hover:bg-accent-hover";

/**
 * Formulario para terminar la compra: datos de contacto, entrega, horario y pago.
 * Los totales que se ven acá son una estimación; el servidor los recalcula al confirmar.
 */
export function FormularioCheckout({
  settings,
  zonas,
  franjas,
  ahora,
}: {
  settings: Settings;
  zonas: DeliveryZone[];
  franjas: TimeSlot[];
  /** Fecha y hora actuales en Argentina, calculadas en el servidor. */
  ahora: { hoy: string; hora: string };
}) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const { listo, noDisponibles } = useCarritoAlDia();
  const itemsPorId = useCarrito((e) => e.items);
  const subtotal = useCarrito(calcularSubtotal);
  const vaciar = useCarrito((e) => e.vaciar);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [modo, setModo] = useState<DeliveryMode>(settings.pickup_enabled ? "pickup" : "delivery");
  const [direccion, setDireccion] = useState("");
  const [referencias, setReferencias] = useState("");
  const [zonaId, setZonaId] = useState("");
  const [fechaElegida, setFechaElegida] = useState("");
  const [franjaElegida, setFranjaElegida] = useState("");
  const [pago, setPago] = useState<PaymentMethod>("transfer");
  const [pagaCon, setPagaCon] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [comentarios, setComentarios] = useState("");

  /** Los errores se muestran recién después del primer intento de enviar, y se van corrigiendo en vivo. */
  const [intentado, setIntentado] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState("");
  const [enviando, setEnviando] = useState(false);
  /** El pedido ya se creó y estamos yendo a la confirmación (el carrito ya está vacío). */
  const [enviado, setEnviado] = useState(false);

  // Completar con los datos de la compra anterior, si los hay.
  useEffect(() => {
    try {
      const guardados = JSON.parse(localStorage.getItem(CLAVE_DATOS) ?? "{}") as DatosGuardados;
      if (guardados.nombre) setNombre(guardados.nombre);
      if (guardados.telefono) setTelefono(guardados.telefono);
      if (guardados.email) setEmail(guardados.email);
      if (guardados.direccion) setDireccion(guardados.direccion);
      if (guardados.referencias) setReferencias(guardados.referencias);
    } catch {
      // localStorage bloqueado o con datos rotos: se arranca con el formulario vacío.
    }
  }, []);

  if (enviado) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-neutral-600" role="status">
        <Spinner className="h-8 w-8 text-accent" label="Enviando" />
        <p>Listo. Te llevamos a tu pedido…</p>
      </div>
    );
  }
  if (!listo) return <CheckoutCargando />;

  const items = Object.values(itemsPorId).sort((a, b) =>
    a.producto.name.localeCompare(b.producto.name, "es"),
  );

  if (items.length === 0) {
    return (
      <EstadoVacio
        titulo="Tu carrito está vacío"
        descripcion="Sumá productos para poder hacer el pedido."
        accion={
          <Link href="/" className={estiloLink}>
            Ver productos
          </Link>
        }
      />
    );
  }

  const hayProblemas = items.some((i) => problemaDelItem(i, settings.track_stock, noDisponibles));
  const compraMinima = Number(settings.min_order_amount);
  if (hayProblemas || subtotal < compraMinima) {
    return (
      <EstadoVacio
        titulo="Revisá tu carrito"
        descripcion={
          hayProblemas
            ? "Hay productos que ya no se pueden comprar."
            : `La compra mínima es de ${formatPrecio(compraMinima)}. Te faltan ${formatPrecio(compraMinima - subtotal)}.`
        }
        accion={
          <Link href="/carrito" className={estiloLink}>
            Volver al carrito
          </Link>
        }
      />
    );
  }

  if (!settings.pickup_enabled && !settings.delivery_enabled) {
    return (
      <EstadoVacio
        titulo="Por ahora no estamos tomando pedidos"
        descripcion="Tu carrito queda guardado. Volvé a intentar más tarde."
      />
    );
  }

  // ---------- Valores derivados ----------
  const porZonas = settings.shipping_mode === "zones";
  const zona = zonas.find((z) => z.id === zonaId) ?? null;
  const envio = calcularEnvio(settings, modo, zona, subtotal);
  const total = subtotal + (envio ?? 0);

  const conHorario = pideHorario(franjas, modo);
  const dias = conHorario ? diasDisponibles(franjas, modo, ahora) : [];
  // Si se cambió de retiro a envío (o al revés), lo elegido puede dejar de ser válido.
  const fecha = dias.includes(fechaElegida) ? fechaElegida : "";
  const franjasDeEseDia = fecha ? franjasDelDia(franjas, modo, fecha, ahora) : [];
  const franjaId = franjasDeEseDia.some((f) => f.id === franjaElegida) ? franjaElegida : "";

  const montoPagaCon = pagaCon.trim() === "" ? null : Number(pagaCon.replace(",", "."));

  function validar(): Errores {
    const e: Errores = {};
    if (!nombre.trim()) e.nombre = "Decinos tu nombre.";
    if (!telefonoValido(telefono)) {
      e.telefono = "Revisá el teléfono: lo necesitamos para avisarte por WhatsApp.";
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) e.email = "Revisá el email.";
    if (modo === "delivery") {
      if (!direccion.trim()) e.direccion = "Decinos a qué dirección te lo llevamos.";
      if (porZonas && !zona) e.zona = "Elegí tu zona de envío.";
    }
    if (conHorario) {
      if (!fecha) e.fecha = "Elegí el día.";
      else if (!franjaId) e.franja = "Elegí el horario.";
    }
    if (pago === "cash" && montoPagaCon !== null) {
      if (!Number.isFinite(montoPagaCon) || montoPagaCon <= 0) e.pagaCon = "Revisá el monto.";
      else if (montoPagaCon < total) {
        e.pagaCon = `El monto tiene que cubrir el total (${formatPrecio(total)}).`;
      }
    }
    if (pago === "transfer" && archivo) {
      if (!COMPROBANTE_TIPOS[archivo.type]) {
        e.comprobante = "Tiene que ser una foto (JPG, PNG, WebP) o un PDF.";
      } else if (archivo.size > COMPROBANTE_MAX_BYTES) {
        e.comprobante = "El archivo es muy pesado: el máximo es 10 MB.";
      }
    }
    return e;
  }

  const errores: Errores = intentado ? validar() : {};

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;

    setIntentado(true);
    setErrorGeneral("");
    if (Object.keys(validar()).length > 0) {
      // Llevar a la persona al primer campo con error.
      requestAnimationFrame(() => {
        const primero = formulario.current?.querySelector<HTMLElement>(
          '[aria-invalid="true"], [data-error="true"]',
        );
        primero?.scrollIntoView({ block: "center", behavior: "smooth" });
        primero?.focus({ preventScroll: true });
      });
      return;
    }

    const pedido: CreateOrderInput = {
      customer_name: nombre.trim(),
      customer_phone: telefono.trim(),
      customer_email: email.trim() || null,
      delivery_mode: modo,
      address: modo === "delivery" ? direccion.trim() : null,
      address_notes: modo === "delivery" ? referencias.trim() || null : null,
      delivery_zone_id: modo === "delivery" && porZonas ? zonaId : null,
      delivery_date: conHorario ? fecha : null,
      time_slot_id: conHorario ? franjaId : null,
      payment_method: pago,
      cash_amount: pago === "cash" ? montoPagaCon : null,
      comments: comentarios.trim() || null,
    };

    const datos = new FormData();
    datos.set("pedido", JSON.stringify(pedido));
    datos.set(
      "items",
      JSON.stringify(items.map((i) => ({ product_id: i.producto.id, quantity: i.cantidad }))),
    );
    if (pago === "transfer" && archivo) datos.set("comprobante", archivo);

    setEnviando(true);
    try {
      const resultado = await crearPedido(datos);
      if (!resultado.ok) {
        setErrorGeneral(resultado.error);
        setEnviando(false);
        return;
      }

      try {
        const guardar: DatosGuardados = {
          nombre: pedido.customer_name,
          telefono: pedido.customer_phone,
          email: pedido.customer_email ?? "",
          direccion: direccion.trim(),
          referencias: referencias.trim(),
        };
        localStorage.setItem(CLAVE_DATOS, JSON.stringify(guardar));
      } catch {
        // No es grave si no se pueden recordar los datos.
      }

      setEnviado(true);
      vaciar();
      router.push(
        `/pedido/${resultado.id}${resultado.errorComprobante ? "?comprobante=pendiente" : ""}`,
      );
    } catch {
      setErrorGeneral("No pudimos enviar tu pedido. Revisá tu conexión y probá de nuevo.");
      setEnviando(false);
    }
  }

  return (
    <form ref={formulario} onSubmit={enviar} noValidate className="space-y-6">
      <div>
        <Link href="/carrito" className="rounded text-sm text-neutral-600 hover:underline">
          ‹ Volver al carrito
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Finalizar compra</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-10">
          {/* ---------- 1. Contacto ---------- */}
          <Seccion numero={1} titulo="Tus datos">
            <Campo label="Nombre y apellido" error={errores.nombre}>
              {(p) => (
                <Input
                  {...p}
                  value={nombre}
                  onChange={(ev) => setNombre(ev.target.value)}
                  autoComplete="name"
                  maxLength={120}
                />
              )}
            </Campo>
            <Campo
              label="Teléfono (WhatsApp)"
              error={errores.telefono}
              ayuda="Con código de área. Te avisamos por ahí cuando el pedido esté listo."
            >
              {(p) => (
                <Input
                  {...p}
                  value={telefono}
                  onChange={(ev) => setTelefono(ev.target.value)}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="11 2345 6789"
                  maxLength={30}
                />
              )}
            </Campo>
            <Campo label="Email" opcional error={errores.email}>
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
          </Seccion>

          {/* ---------- 2. Entrega ---------- */}
          <Seccion numero={2} titulo="¿Cómo lo querés recibir?">
            <GrupoOpciones leyenda="Forma de entrega">
              {settings.pickup_enabled && (
                <Opcion
                  nombre="modo"
                  marcada={modo === "pickup"}
                  onElegir={() => setModo("pickup")}
                  titulo="Retiro en el local"
                  detalle={settings.store_address ?? "Sin costo"}
                  derecha="Gratis"
                />
              )}
              {settings.delivery_enabled && (
                <Opcion
                  nombre="modo"
                  marcada={modo === "delivery"}
                  onElegir={() => setModo("delivery")}
                  titulo="Envío a domicilio"
                  detalle={
                    settings.free_shipping_from != null
                      ? `Gratis desde ${formatPrecio(Number(settings.free_shipping_from))}`
                      : undefined
                  }
                  derecha={
                    settings.free_shipping_from != null &&
                    subtotal >= Number(settings.free_shipping_from)
                      ? "Gratis"
                      : porZonas
                        ? "Según la zona"
                        : formatPrecio(Number(settings.shipping_fixed_cost))
                  }
                />
              )}
            </GrupoOpciones>

            {modo === "delivery" && (
              <>
                <Campo label="Dirección" error={errores.direccion}>
                  {(p) => (
                    <Input
                      {...p}
                      value={direccion}
                      onChange={(ev) => setDireccion(ev.target.value)}
                      autoComplete="street-address"
                      placeholder="Calle y número"
                      maxLength={300}
                    />
                  )}
                </Campo>
                <Campo label="Piso, departamento o referencias" opcional>
                  {(p) => (
                    <Input
                      {...p}
                      value={referencias}
                      onChange={(ev) => setReferencias(ev.target.value)}
                      placeholder="Ej: 2° B, timbre que no anda, portón verde"
                      maxLength={300}
                    />
                  )}
                </Campo>
                {porZonas && (
                  <Campo label="Zona de envío" error={errores.zona}>
                    {(p) => (
                      <Select {...p} value={zonaId} onChange={(ev) => setZonaId(ev.target.value)}>
                        <option value="">Elegí tu zona</option>
                        {zonas.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name} — {formatPrecio(Number(z.cost))}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Campo>
                )}
              </>
            )}
          </Seccion>

          {/* ---------- 3. Día y horario ---------- */}
          {conHorario && (
            <Seccion
              numero={3}
              titulo={modo === "pickup" ? "¿Cuándo lo retirás?" : "¿Cuándo te lo llevamos?"}
            >
              {dias.length === 0 ? (
                <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800" data-error="true" tabIndex={-1}>
                  No hay horarios disponibles para esta forma de entrega. Probá con la otra o
                  escribinos por WhatsApp.
                </p>
              ) : (
                <>
                  <Campo label="Día" error={errores.fecha}>
                    {(p) => (
                      <Select
                        {...p}
                        value={fecha}
                        onChange={(ev) => {
                          setFechaElegida(ev.target.value);
                          setFranjaElegida("");
                        }}
                      >
                        <option value="">Elegí el día</option>
                        {dias.map((d) => (
                          <option key={d} value={d}>
                            {formatFecha(d, ahora.hoy)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Campo>

                  {fecha && (
                    <GrupoOpciones leyenda="Horario" visible error={errores.franja} enFila>
                      {franjasDeEseDia.map((f) => (
                        <Opcion
                          key={f.id}
                          nombre="franja"
                          marcada={franjaId === f.id}
                          onElegir={() => setFranjaElegida(f.id)}
                          titulo={`${etiquetaFranja(f)} h`}
                        />
                      ))}
                    </GrupoOpciones>
                  )}
                </>
              )}
            </Seccion>
          )}

          {/* ---------- 4. Pago ---------- */}
          <Seccion numero={conHorario ? 4 : 3} titulo="¿Cómo pagás?">
            <GrupoOpciones leyenda="Forma de pago">
              <Opcion
                nombre="pago"
                marcada={pago === "transfer"}
                onElegir={() => setPago("transfer")}
                titulo="Transferencia"
                detalle="Transferís y nos mandás el comprobante."
              />
              <Opcion
                nombre="pago"
                marcada={pago === "cash"}
                onElegir={() => setPago("cash")}
                titulo="Efectivo"
                detalle={modo === "pickup" ? "Pagás al retirar." : "Pagás al recibir."}
              />
            </GrupoOpciones>

            {pago === "transfer" && (
              <div className="space-y-4 rounded-lg bg-neutral-50 p-4">
                {(settings.bank_alias || settings.bank_cbu) && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    {settings.bank_alias && (
                      <>
                        <dt className="text-neutral-600">Alias</dt>
                        <dd className="break-all font-medium">{settings.bank_alias}</dd>
                      </>
                    )}
                    {settings.bank_cbu && (
                      <>
                        <dt className="text-neutral-600">CBU</dt>
                        <dd className="break-all font-medium tabular-nums">{settings.bank_cbu}</dd>
                      </>
                    )}
                    {settings.bank_holder && (
                      <>
                        <dt className="text-neutral-600">Titular</dt>
                        <dd>{settings.bank_holder}</dd>
                      </>
                    )}
                  </dl>
                )}
                <Campo
                  label="Comprobante"
                  opcional
                  error={errores.comprobante}
                  ayuda="Foto o PDF, hasta 10 MB. Si todavía no transferiste, lo podés subir después de confirmar."
                >
                  {(p) => (
                    <input
                      {...p}
                      type="file"
                      accept={Object.keys(COMPROBANTE_TIPOS).join(",")}
                      onChange={(ev) => setArchivo(ev.target.files?.[0] ?? null)}
                      className="block w-full rounded-lg text-sm text-neutral-700 file:mr-3 file:h-10 file:cursor-pointer file:rounded-lg file:border file:border-solid file:border-neutral-300 file:bg-white file:px-4 file:text-sm file:font-medium file:text-neutral-900 hover:file:bg-neutral-50"
                    />
                  )}
                </Campo>
              </div>
            )}

            {pago === "cash" && (
              <Campo
                label="¿Con cuánto pagás?"
                opcional
                error={errores.pagaCon}
                ayuda="Así llevamos el vuelto justo."
              >
                {(p) => (
                  <Input
                    {...p}
                    value={pagaCon}
                    onChange={(ev) => setPagaCon(ev.target.value)}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder={`Ej: ${Math.ceil(total / 1000) * 1000}`}
                    className="max-w-48"
                  />
                )}
              </Campo>
            )}

            <Campo label="Comentarios" opcional>
              {(p) => (
                <Textarea
                  {...p}
                  value={comentarios}
                  onChange={(ev) => setComentarios(ev.target.value)}
                  placeholder="Ej: si no hay de una marca, mandame otra parecida."
                  maxLength={1000}
                />
              )}
            </Campo>
          </Seccion>
        </div>

        {/* ---------- Resumen ---------- */}
        <section
          aria-labelledby="titulo-resumen"
          className="space-y-4 rounded-lg border border-neutral-200 p-4 lg:sticky lg:top-24"
        >
          <h2 id="titulo-resumen" className="font-semibold">
            Tu pedido
          </h2>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {items.map(({ producto, cantidad }) => (
              <li key={producto.id} className="flex justify-between gap-3">
                <span className="min-w-0 text-neutral-700">
                  <span className="font-medium tabular-nums text-neutral-900">
                    {formatCantidad(cantidad, producto.sale_unit)} ×
                  </span>{" "}
                  {producto.name}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatPrecio(Math.round(producto.price * cantidad * 100) / 100)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-neutral-200 pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">Subtotal</dt>
              <dd className="tabular-nums">{formatPrecio(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">{modo === "pickup" ? "Retiro en el local" : "Envío"}</dt>
              <dd className="tabular-nums">
                {envio === null ? "Elegí tu zona" : envio === 0 ? "Gratis" : formatPrecio(envio)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-neutral-200 pt-3">
              <dt className="font-semibold">Total</dt>
              <dd className="text-xl font-semibold tabular-nums">{formatPrecio(total)}</dd>
            </div>
          </dl>

          {errorGeneral && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorGeneral}
            </p>
          )}

          <Button type="submit" tamano="lg" cargando={enviando} className="w-full">
            {enviando ? "Enviando…" : "Confirmar pedido"}
          </Button>
          <p className="text-center text-xs text-neutral-600">
            Los precios se confirman al enviar el pedido.
          </p>
        </section>
      </div>
    </form>
  );
}

/** Bloque numerado del formulario. */
function Seccion({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-3 text-lg font-semibold tracking-tight">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm text-accent"
        >
          {numero}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/** Grupo de opciones excluyentes (radios con forma de tarjeta). */
function GrupoOpciones({
  leyenda,
  visible,
  error,
  enFila,
  children,
}: {
  leyenda: string;
  /** Muestra la leyenda (por defecto solo la leen los lectores de pantalla). */
  visible?: boolean;
  error?: string;
  /** Opciones cortas, una al lado de la otra. */
  enFila?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-1.5" data-error={error ? "true" : undefined} tabIndex={-1}>
      <legend
        className={visible ? "mb-1.5 block text-sm font-medium text-neutral-800" : "sr-only"}
      >
        {leyenda}
      </legend>
      <div className={enFila ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "grid gap-2 sm:grid-cols-2"}>
        {children}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function Opcion({
  nombre,
  marcada,
  onElegir,
  titulo,
  detalle,
  derecha,
}: {
  nombre: string;
  marcada: boolean;
  onElegir: () => void;
  titulo: string;
  detalle?: string;
  derecha?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2",
        marcada ? "border-accent bg-accent-soft" : "border-neutral-300 hover:bg-neutral-50",
      )}
    >
      <input
        type="radio"
        name={nombre}
        checked={marcada}
        onChange={onElegir}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--accent))] focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-neutral-900">{titulo}</span>
          {derecha && <span className="shrink-0 text-sm text-neutral-700">{derecha}</span>}
        </span>
        {detalle && <span className="block text-sm text-neutral-600">{detalle}</span>}
      </span>
    </label>
  );
}

function CheckoutCargando() {
  return (
    <div className="space-y-6" aria-busy>
      <Skeleton className="h-7 w-48" />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
