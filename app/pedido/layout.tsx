import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pedido",
  robots: { index: false, follow: false },
};

/** Rotas do checkout: fora do índice de busca. Cada etapa tem a própria guarda (useGuardaEtapa). */
export default function LayoutPedido({ children }: { children: React.ReactNode }) {
  return children;
}
