"use client";

import type { Produto } from "@/config/loja";
import { definirCatalogo } from "@/lib/catalogo";

/**
 * Entrega ao navegador o cardápio lido no servidor. Envolve a página para que a lista seja definida
 * antes de qualquer componente filho (sacola, checkout) usá-la.
 */
export function Catalogo({ produtos, children }: { produtos: Produto[]; children: React.ReactNode }) {
  definirCatalogo(produtos);
  return children;
}
