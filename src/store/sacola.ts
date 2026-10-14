import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { loja, produtoPorSlug } from "@/config/loja";

/**
 * Sacola: o ÚNICO estado salvo no aparelho (localStorage), com ids e quantidades.
 * Nenhum dado pessoal passa por aqui.
 */
type EstadoSacola = {
  itens: Record<string, number>;
  hidratada: boolean;
  somar: (slug: string, delta: number) => void;
  definir: (slug: string, quantidade: number) => void;
  limpar: () => void;
};

const MAX_POR_ITEM = 50;

function comQuantidade(itens: Record<string, number>, slug: string, q: number) {
  const novo = { ...itens };
  if (q <= 0) delete novo[slug];
  else novo[slug] = Math.min(MAX_POR_ITEM, q);
  return novo;
}

export const useSacola = create<EstadoSacola>()(
  persist(
    (set) => ({
      itens: {},
      hidratada: false,
      somar: (slug, delta) =>
        set((s) => {
          const p = produtoPorSlug(slug);
          if (!p || (delta > 0 && !p.disponivel)) return s;
          return { itens: comQuantidade(s.itens, slug, (s.itens[slug] ?? 0) + delta) };
        }),
      definir: (slug, quantidade) =>
        set((s) => {
          const p = produtoPorSlug(slug);
          if (!p || (quantidade > (s.itens[slug] ?? 0) && !p.disponivel)) return s;
          return { itens: comQuantidade(s.itens, slug, quantidade) };
        }),
      limpar: () => set({ itens: {} }),
    }),
    {
      name: "ck_sacola",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ itens: s.itens }),
      // A home é estática: a sacola é lida só depois da hidratação para não dar diferença com o HTML.
      skipHydration: true,
      merge: (salvo, atual) => {
        const itens: Record<string, number> = {};
        const bruto = (salvo as { itens?: Record<string, unknown> } | undefined)?.itens ?? {};
        for (const [slug, q] of Object.entries(bruto)) {
          if (produtoPorSlug(slug) && typeof q === "number" && q > 0)
            itens[slug] = Math.min(MAX_POR_ITEM, Math.floor(q));
        }
        return { ...atual, itens };
      },
      onRehydrateStorage: () => () => useSacola.setState({ hidratada: true }),
    },
  ),
);

/** Linhas da sacola na ordem do cardápio. */
export const linhasSacola = (itens: Record<string, number>) =>
  loja.produtos.filter((p) => itens[p.slug]).map((p) => ({ produto: p, quantidade: itens[p.slug] }));

export const quantidadeTotal = (itens: Record<string, number>) =>
  Object.values(itens).reduce((a, b) => a + b, 0);

export const subtotalSacola = (itens: Record<string, number>) =>
  loja.produtos.reduce((s, p) => s + (itens[p.slug] ?? 0) * p.preco, 0);
