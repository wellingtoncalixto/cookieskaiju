import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

/**
 * Lê uma nota fiscal / cupom fiscal de compra (foto ou PDF) com o Claude e devolve os itens já no formato dos
 * insumos: quantas embalagens, o conteúdo de UMA embalagem (g, ml ou un) e o valor pago pela linha.
 * O resultado é só uma sugestão: o admin confere tudo antes de aplicar.
 */

const ItemLido = z.object({
  descricao: z.string(),
  quantidade: z.number(),
  tamanho_embalagem: z.number().nullable(),
  unidade: z.enum(["g", "ml", "un"]).nullable(),
  valor_total: z.number(),
  insumo_id: z.number().int().nullable(),
});

const NotaLida = z.object({
  legivel: z.boolean(),
  fornecedor: z.string(),
  data: z.string().nullable(),
  total: z.number().nullable(),
  itens: z.array(ItemLido),
  observacao: z.string(),
});
export type NotaLida = z.infer<typeof NotaLida>;

export type InsumoParaLeitura = { id: number; nome: string; unidade: string };
export type ArquivoNota = { tipo: string; base64: string };

export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

const SISTEMA = `Você lê notas fiscais e cupons fiscais brasileiros (NF-e/DANFE, NFC-e, cupom SAT, recibos) de compras
de uma confeitaria de cookies artesanais, para atualizar o custo dos ingredientes e embalagens.

Para cada linha de produto comprado, preencha:
- descricao: o nome do produto como está na nota, por extenso e legível (expanda abreviações óbvias).
- quantidade: quantas embalagens/unidades foram compradas (a coluna QTD). Produto vendido por peso
  (ex.: 0,535 KG de queijo) conta como 1 embalagem do peso comprado.
- tamanho_embalagem e unidade: o conteúdo de UMA embalagem, convertido para gramas (g), mililitros (ml) ou
  unidades (un). Ex.: "LEITE COND 395G" -> 395 g; "MANTEIGA 500G" x2 -> quantidade 2, 500 g; "OVOS BRANCOS
  C/30" -> 30 un; "CREME DE LEITE 1L" -> 1000 ml; peso 0,535 KG -> 535 g. Se o tamanho não aparecer na nota,
  use null nos dois.
- valor_total: o valor pago pela linha inteira (todas as embalagens), já descontando o desconto do item, se
  houver. Use ponto como separador decimal.
- insumo_id: o id do insumo cadastrado (lista abaixo) que é claramente o mesmo produto, ou null se nenhum
  corresponder com segurança. Não force correspondências: marca diferente do mesmo produto pode corresponder;
  produtos diferentes não.

Também: fornecedor (nome da loja/emitente), data da compra em AAAA-MM-DD (ou null), total pago (ou null) e uma
observação curta em português se algo ficou ilegível ou duvidoso (senão, string vazia).
Ignore linhas que não são produtos (troco, impostos, formas de pagamento, totais).
Se o arquivo não for uma nota/cupom legível, use legivel=false e itens vazio.`;

/** Chama o Claude com o arquivo. Separado para os testes poderem trocar por uma resposta pronta. */
export type LeitorNota = (arquivo: ArquivoNota, insumos: InsumoParaLeitura[]) => Promise<NotaLida>;

export const leitorClaude: LeitorNota = async (arquivo, insumos) => {
  const client = new Anthropic(); // ANTHROPIC_API_KEY
  const bloco: Anthropic.Beta.BetaContentBlockParam =
    arquivo.tipo === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: arquivo.base64 } }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: arquivo.tipo as "image/jpeg" | "image/png" | "image/webp",
            data: arquivo.base64,
          },
        };
  const resposta = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // Se o modelo recusar por engano (classificador de segurança), o servidor refaz com outro modelo.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SISTEMA,
    messages: [
      {
        role: "user",
        content: [
          bloco,
          {
            type: "text",
            text: `Insumos cadastrados (id, nome, unidade):\n${JSON.stringify(insumos)}\n\nLeia a nota acima.`,
          },
        ],
      },
    ],
    output_config: { format: betaZodOutputFormat(NotaLida) },
  });
  if (resposta.stop_reason === "refusal") throw new ErroLeitura("A IA recusou ler este arquivo.");
  if (resposta.stop_reason === "max_tokens")
    throw new ErroLeitura("A nota é longa demais para ler de uma vez.");
  if (!resposta.parsed_output) throw new ErroLeitura("Não foi possível entender a resposta da IA.");
  return resposta.parsed_output;
};

export class ErroLeitura extends Error {}

/** Mensagem amigável para os erros da API. */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof ErroLeitura) return e.message;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
    return "Chave da API da Anthropic inválida (ANTHROPIC_API_KEY).";
  if (e instanceof Anthropic.RateLimitError) return "Muitas leituras seguidas. Tente de novo em 1 minuto.";
  if (e instanceof Anthropic.BadRequestError) return "O arquivo não pôde ser lido (formato ou tamanho).";
  if (e instanceof Anthropic.APIConnectionError) return "Sem conexão com a IA. Tente de novo.";
  if (e instanceof Anthropic.APIError) return `Erro da IA (${e.status}). Tente de novo.`;
  return "Falha ao ler a nota.";
}

/**
 * Limpa o que veio da IA: só ids de insumos que existem, números válidos, data no formato certo,
 * descrições curtas. Nada do arquivo é tratado como instrução: é só dado a conferir.
 */
export function sanearNota(n: NotaLida, insumos: InsumoParaLeitura[]): NotaLida {
  const ids = new Set(insumos.map((i) => i.id));
  const num = (v: number | null, min = 0) => (v != null && Number.isFinite(v) && v >= min ? v : null);
  return {
    legivel: n.legivel,
    fornecedor: n.fornecedor.trim().slice(0, 120),
    data: n.data && /^\d{4}-\d{2}-\d{2}$/.test(n.data) && !Number.isNaN(Date.parse(n.data)) ? n.data : null,
    total: num(n.total),
    observacao: n.observacao.trim().slice(0, 300),
    itens: n.itens
      .filter((i) => i.descricao.trim())
      .slice(0, 100)
      .map((i) => {
        const tamanho = num(i.tamanho_embalagem, 0.001);
        return {
          descricao: i.descricao.trim().slice(0, 160),
          quantidade: num(i.quantidade, 0.001) ?? 1,
          tamanho_embalagem: tamanho,
          unidade: tamanho == null ? null : i.unidade,
          valor_total: Math.round((num(i.valor_total) ?? 0) * 100) / 100,
          insumo_id: i.insumo_id != null && ids.has(i.insumo_id) ? i.insumo_id : null,
        };
      }),
  };
}
