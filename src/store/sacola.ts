import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { loja, produtoPorSlug } from "@/config/loja";
import { sacolaExpirada } from "@/lib/tempo";

/**
 * Sacola: o ÚNICO estado salvo no aparelho (localStorage), com ids, quantidades e o horário da
 * última atividade. Nenhum dado pessoal passa por aqui.
 * Se o cliente ficar mais de `loja.sacolaExpiraHoras` sem voltar ao site, a sacola é apagada.
 */
type EstadoSacola = {
  itens: Record<string, number>;
  /** Última visita ou mudança na sacola (ms). Renovado a cada visita. */
  atualizadoEm: number;
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
      atualizadoEm: 0,
      hidratada: false,
      somar: (slug, delta) =>
        set((s) => {
          const p = produtoPorSlug(slug);
          if (!p || (delta > 0 && !p.disponivel)) return s;
          return {
            itens: comQuantidade(s.itens, slug, (s.itens[slug] ?? 0) + delta),
            atualizadoEm: Date.now(),
          };
        }),
      definir: (slug, quantidade) =>
        set((s) => {
          const p = produtoPorSlug(slug);
          if (!p || (quantidade > (s.itens[slug] ?? 0) && !p.disponivel)) return s;
          return { itens: comQuantidade(s.itens, slug, quantidade), atualizadoEm: Date.now() };
        }),
      limpar: () => set({ itens: {}, atualizadoEm: Date.now() }),
    }),
    {
      name: "ck_sacola",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ itens: s.itens, atualizadoEm: s.atualizadoEm }),
      // A home é estática: a sacola é lida só depois da hidratação para não dar diferença com o HTML.
      skipHydration: true,
      merge: (salvo, atual) => {
        const dados = salvo as { itens?: Record<string, unknown>; atualizadoEm?: unknown } | undefined;
        const agora = Date.now();
        // Sacolas salvas antes desta regra não têm horário: contam a partir de agora.
        const ultima = typeof dados?.atualizadoEm === "number" ? dados.atualizadoEm : agora;
        const itens: Record<string, number> = {};
        if (!sacolaExpirada(ultima, agora, loja.sacolaExpiraHoras)) {
          for (const [slug, q] of Object.entries(dados?.itens ?? {})) {
            if (produtoPorSlug(slug) && typeof q === "number" && q > 0)
              itens[slug] = Math.min(MAX_POR_ITEM, Math.floor(q));
          }
        }
        // Voltar ao site renova o prazo.
        return { ...atual, itens, atualizadoEm: agora };
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
