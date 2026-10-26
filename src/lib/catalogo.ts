import { loja, type Produto } from "@/config/loja";

/**
 * Cardápio em uso. A fonte é o banco (cadastro do admin); `loja.produtos` é a reserva quando o banco não
 * está configurado. No servidor, as páginas recebem a lista de `obterCatalogo()`; no navegador, o
 * <Catalogo> do layout define a lista antes de qualquer outro componente usar.
 */
let atual: Produto[] = loja.produtos;

export const catalogoAtual = () => atual;

export function definirCatalogo(lista: Produto[]) {
  atual = lista;
}

export const produtoPorSlug = (slug: string, lista: Produto[] = atual) => lista.find((p) => p.slug === slug);

export const menorPreco = (lista: Produto[] = atual) => Math.min(...lista.map((p) => p.preco));

export const imagemProduto = (p: Pick<Produto, "slug" | "foto">) => p.foto || `/cookies/${p.slug}.jpg`;

export const posterProduto = (p: Pick<Produto, "slug" | "cartaz" | "foto">) =>
  p.cartaz || (p.foto ? p.foto : `/cookies/posters/${p.slug}-cartaz.jpg`);

/** "A, B, C e D" */
export const listaNomes = (lista: Produto[] = atual) => {
  const nomes = lista.map((p) => p.nome);
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}` : (nomes[0] ?? "");
};
