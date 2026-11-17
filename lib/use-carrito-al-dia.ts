"use client";

import { useEffect, useState } from "react";
import { COLUMNAS_TARJETA, type ProductoTarjeta } from "@/lib/data/consultas";
import { formatCantidad } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { useMontado } from "@/lib/use-montado";
import { useCarrito, type ItemCarrito } from "@/store/carrito";

/**
 * El carrito guarda una copia de cada producto, que puede quedar vieja
 * (cambió el precio, se quedó sin stock, se dio de baja). Este hook vuelve a
 * pedir esos productos a la base al entrar al carrito o al checkout, y avisa
 * cuáles ya no se pueden comprar.
 *
 * - `listo`: false mientras se está consultando (o antes de leer localStorage).
 * - `noDisponibles`: ids de productos que ya no existen o están inactivos.
 * - `fallo`: no se pudo consultar; se sigue con los datos guardados
 *   (igual el servidor valida todo al confirmar).
 */
export function useCarritoAlDia() {
  const montado = useMontado();
  const actualizarProductos = useCarrito((e) => e.actualizarProductos);
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [noDisponibles, setNoDisponibles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!montado) return;
    // Se consulta una sola vez, con lo que haya en el carrito al entrar.
    const ids = Object.keys(useCarrito.getState().items);
    if (ids.length === 0) {
      setListo(true);
      return;
    }
    let cancelado = false;
    createClient()
      .from("products")
      .select(COLUMNAS_TARJETA)
      .in("id", ids)
      .eq("active", true)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          setFallo(true);
        } else {
          const actuales = (data ?? []) as ProductoTarjeta[];
          actualizarProductos(actuales);
          const encontrados = new Set(actuales.map((p) => p.id));
          setNoDisponibles(new Set(ids.filter((id) => !encontrados.has(id))));
        }
        setListo(true);
      });
    return () => {
      cancelado = true;
    };
  }, [montado, actualizarProductos]);

  return { listo: montado && listo, fallo, noDisponibles };
}

/**
 * Motivo por el que un producto del carrito no se puede comprar tal como está,
 * o null si está todo bien. Son los mismos controles que hace create_order().
 */
export function problemaDelItem(
  { producto, cantidad }: ItemCarrito,
  controlarStock: boolean,
  noDisponibles: Set<string>,
): string | null {
  if (noDisponibles.has(producto.id)) return "Ya no está disponible. Sacalo para continuar.";
  if (producto.price <= 0) return "Todavía no tiene precio cargado. Sacalo para continuar.";
  if (controlarStock) {
    if (producto.stock <= 0) return "Se quedó sin stock. Sacalo para continuar.";
    if (cantidad > producto.stock) {
      return `Quedan solo ${formatCantidad(Number(producto.stock), producto.sale_unit)}. Bajá la cantidad.`;
    }
  }
  return null;
}
