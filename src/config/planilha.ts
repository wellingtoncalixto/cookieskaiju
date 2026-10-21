import type { FormaPagamento } from "@/config/loja";

/**
 * Integração com o Painel Comercial (Google Sheets).
 *
 * Os textos abaixo precisam bater EXATAMENTE com os que as fórmulas da planilha reconhecem.
 * As posições das colunas ficam no Apps Script (apps-script/Nucleo.gs), não aqui.
 */
export const planilha = {
  status: "Pendente",
  origem: "site",
  tipoRegistro: "Site automático",
  atendimento: { entrega: "Entrega", retirada: "Retirada" },
  /** Forma de pagamento do site → texto da coluna E (Pedidos). */
  pagamento: {
    pix: "Pix",
    credito: "InfiniteTap crédito",
    debito: "InfiniteTap débito",
    // Não está na lista das fórmulas: confira como a coluna K (taxa de pagamento) trata "Dinheiro".
    dinheiro: "Dinheiro",
  } satisfies Record<FormaPagamento["id"], string>,
  /**
   * Nome do produto como aparece na aba Produtos (coluna B de Itens). Se algum nome for diferente do
   * site, coloque aqui: { "explosao-de-nutella": "Explosão de Nutella" }. Sem entrada, usa o nome do site.
   */
  nomeProduto: {} as Record<string, string>,
} as const;

/** Liga o registro automático de pedidos. Sem isso, o checkout funciona exatamente como antes. */
export const REGISTRO_PEDIDOS_ATIVO = process.env.NEXT_PUBLIC_REGISTRO_PEDIDOS === "true";
