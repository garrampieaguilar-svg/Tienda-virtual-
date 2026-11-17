"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductoTarjeta } from "@/lib/data/consultas";

/**
 * Carrito de compras.
 * Vive en el navegador y se guarda en localStorage, así funciona sin registrarse
 * y no se pierde al cerrar la pestaña.
 *
 * Guardamos una copia de los datos del producto para poder dibujar el carrito
 * sin consultar la base. OJO: el precio guardado es solo para mostrar; al confirmar
 * el pedido, el servidor recalcula todo con los precios actuales.
 */

export type ItemCarrito = { producto: ProductoTarjeta; cantidad: number };

type EstadoCarrito = {
  items: Record<string, ItemCarrito>;
  /** Suma un "paso" del producto (1 unidad, o 0,25 kg, etc.). Si no estaba, lo agrega. */
  sumar: (producto: ProductoTarjeta) => void;
  /** Resta un paso. Si llega a cero, lo saca del carrito. */
  restar: (id: string) => void;
  quitar: (id: string) => void;
  vaciar: () => void;
  /**
   * Reemplaza los datos guardados de cada producto por los actuales de la base
   * (precio, stock, nombre). Las cantidades no se tocan.
   */
  actualizarProductos: (productos: ProductoTarjeta[]) => void;
};

/** Evita errores de decimales (0.1 + 0.2) al sumar pasos como 0,25. */
const redondear = (n: number) => Math.round(n * 1000) / 1000;

export const useCarrito = create<EstadoCarrito>()(
  persist(
    (set) => ({
      items: {},
      sumar: (producto) =>
        set((estado) => {
          const actual = estado.items[producto.id]?.cantidad ?? 0;
          return {
            items: {
              ...estado.items,
              [producto.id]: {
                producto,
                cantidad: redondear(actual + Number(producto.quantity_step)),
              },
            },
          };
        }),
      restar: (id) =>
        set((estado) => {
          const item = estado.items[id];
          if (!item) return estado;
          const nueva = redondear(item.cantidad - Number(item.producto.quantity_step));
          const items = { ...estado.items };
          if (nueva <= 0) delete items[id];
          else items[id] = { ...item, cantidad: nueva };
          return { items };
        }),
      quitar: (id) =>
        set((estado) => {
          const items = { ...estado.items };
          delete items[id];
          return { items };
        }),
      vaciar: () => set({ items: {} }),
      actualizarProductos: (productos) =>
        set((estado) => {
          const items = { ...estado.items };
          for (const producto of productos) {
            const item = items[producto.id];
            if (item) items[producto.id] = { ...item, producto };
          }
          return { items };
        }),
    }),
    { name: "carrito-v1" },
  ),
);

/** Cantidad de productos distintos en el carrito (el numerito del ícono). */
export const contarItems = (estado: EstadoCarrito) => Object.keys(estado.items).length;

/** Subtotal estimado con los precios guardados. */
export const calcularSubtotal = (estado: EstadoCarrito) =>
  Object.values(estado.items).reduce(
    (total, { producto, cantidad }) => total + Math.round(producto.price * cantidad * 100) / 100,
    0,
  );
