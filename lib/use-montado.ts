"use client";

import { useEffect, useState } from "react";

/**
 * Devuelve true recién cuando el componente ya está en el navegador.
 * Sirve para lo que depende de localStorage (el carrito): en el servidor
 * no existe, así que esperamos a estar montados para mostrarlo y evitamos
 * diferencias entre el HTML del servidor y el del navegador.
 */
export function useMontado(): boolean {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return montado;
}
