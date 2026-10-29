/**
 * Valores de um pedido no momento do registro (as fórmulas da antiga aba Pedidos, colunas H–M).
 * Um valor `null` significa "não dá para calcular" (falta parâmetro ou frete a confirmar): nunca vira zero.
 */

export type Pagamento = "pix" | "credito" | "debito" | "dinheiro";

/** Parâmetros da tabela `configuracao` usados aqui (valor nulo = não informado). */
export type ConfigCustos = {
  kraft_preco: number | null;
  kraft_cookies_por_saco: number | null;
  flyer_aquecimento: number | null;
  flyer_marca: number | null;
  moto_km_por_litro: number | null;
  gasolina_litro: number | null;
  taxa_pix: number | null;
  taxa_debito: number | null;
  taxa_credito: number | null;
  taxa_dinheiro: number | null;
};

export type EntradaValores = {
  itens: { quantidade: number; preco: number; custo: number | null }[];
  modalidade: "entrega" | "retirada";
  pagamento: Pagamento;
  /** Frete cobrado; null = a confirmar. */
  frete: number | null;
  /** Distância de ida; null = desconhecida. */
  distanciaKm: number | null;
};

export type ValoresPedido = {
  quantidade: number;
  receita: number;
  custo: number | null;
  embalagem: number | null;
  taxa: number | null;
  combustivel: number | null;
  contribuicao: number | null;
};

const soma = (xs: (number | null)[]) =>
  xs.some((x) => x == null) ? null : xs.reduce<number>((s, x) => s + x!, 0);

export function calcularValoresPedido(e: EntradaValores, cfg: ConfigCustos): ValoresPedido {
  const quantidade = e.itens.reduce((s, i) => s + i.quantidade, 0);
  const receita = e.itens.reduce((s, i) => s + i.quantidade * i.preco, 0);
  const custo = soma(e.itens.map((i) => (i.custo == null ? null : i.quantidade * i.custo)));

  const embalagem =
    cfg.kraft_preco == null ||
    !cfg.kraft_cookies_por_saco ||
    cfg.flyer_aquecimento == null ||
    cfg.flyer_marca == null
      ? null
      : Math.ceil(quantidade / cfg.kraft_cookies_por_saco) * cfg.kraft_preco +
        cfg.flyer_aquecimento +
        cfg.flyer_marca;

  const pct = cfg[`taxa_${e.pagamento}`];
  const taxa = pct == null ? null : (receita + (e.frete ?? 0)) * pct;

  const combustivel =
    e.modalidade === "retirada"
      ? 0
      : e.distanciaKm == null || cfg.gasolina_litro == null || !cfg.moto_km_por_litro
        ? null
        : (2 * e.distanciaKm * cfg.gasolina_litro) / cfg.moto_km_por_litro;

  const parcelas = soma([custo, embalagem, taxa, combustivel, e.frete]);
  const contribuicao =
    parcelas == null ? null : receita + e.frete! - custo! - embalagem! - taxa! - combustivel!;

  return { quantidade, receita, custo, embalagem, taxa, combustivel, contribuicao };
}
