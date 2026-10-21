import { z } from "zod";
import { loja, produtoPorSlug } from "@/config/loja";
import { planilha } from "@/config/planilha";
import { CHAVE_AGORA } from "@/lib/agenda";
import { normalizar, soDigitos } from "@/lib/formato";
import { avaliarPromo } from "@/lib/frete";
import { idPedidoValido } from "@/lib/id-pedido";
import { isoData, minutosDoDia, paredeSP } from "@/lib/tempo";
import type { Cotacao } from "@/lib/assinatura";

/**
 * O que o navegador manda para /api/pedidos. Sem nome, telefone, endereço nem mensagem:
 * só o necessário para o Painel Comercial.
 */
export const esquemaEntrada = z.object({
  id: z.string().refine(idPedidoValido, { error: "id inválido" }),
  modalidade: z.enum(["entrega", "retirada"]),
  /** "agora" ou "AAAA-MM-DD|faixa" (só a data é usada, para a promoção). */
  horario: z.string().max(40),
  itens: z
    .array(z.object({ slug: z.string().max(60), quantidade: z.number().int().min(1).max(50) }))
    .min(1)
    .max(10),
  pagamento: z.enum(["pix", "credito", "debito", "dinheiro"]),
  cidade: z.string().trim().max(80).default(""),
  cep: z.string().max(9).default(""),
  /** Cotação de frete assinada por /api/frete (opcional: sem ela, frete e distância ficam em branco). */
  cotacao: z.string().max(600).optional(),
});
export type EntradaRegistro = z.infer<typeof esquemaEntrada>;

/** O que vai para o Apps Script gravar. As colunas com fórmulas (Pedidos H–M, Itens D–G) não aparecem aqui. */
export type CorpoPlanilha = {
  id: string;
  /** AAAA-MM-DD e HH:mm, horário de São Paulo, no momento do registro (relógio do servidor). */
  data: string;
  hora: string;
  cidade: string;
  /** Número, ou "" quando desconhecida (frete a confirmar). */
  distanciaKm: number | "";
  pagamento: string;
  status: string;
  frete: number | "";
  origem: string;
  atendimento: string;
  relacao: "";
  comoConheceu: "";
  tipoRegistro: string;
  itens: { produto: string; quantidade: number }[];
};

export type ResultadoMontagem = { ok: true; corpo: CorpoPlanilha } | { ok: false; erro: string };

/**
 * Valida e recalcula o pedido no servidor:
 * - produtos e disponibilidade vêm de src/config/loja.ts (o preço é calculado pelas fórmulas da planilha);
 * - o frete só é aceito com cotação assinada que bate com o CEP; a promoção é recalculada aqui;
 * - data e hora são do servidor, nunca do navegador.
 */
export function montarRegistro(
  entrada: EntradaRegistro,
  agora: number,
  lerCotacao: (token: string | undefined) => Cotacao | null,
): ResultadoMontagem {
  const vistos = new Set<string>();
  const itens: CorpoPlanilha["itens"] = [];
  for (const i of entrada.itens) {
    const p = produtoPorSlug(i.slug);
    if (!p) return { ok: false, erro: "produto_desconhecido" };
    if (!p.disponivel) return { ok: false, erro: "produto_esgotado" };
    if (vistos.has(p.slug)) return { ok: false, erro: "produto_repetido" };
    vistos.add(p.slug);
    itens.push({ produto: planilha.nomeProduto[p.slug] ?? p.nome, quantidade: i.quantidade });
  }
  const quantidade = itens.reduce((s, i) => s + i.quantidade, 0);

  const parede = paredeSP(agora);
  const min = minutosDoDia(parede);
  const data = isoData(parede);
  const hora = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  let cidade = "";
  let distanciaKm: number | "" = "";
  let frete: number | "" = "";
  if (entrada.modalidade === "retirada") {
    // Retirada: sem deslocamento (o combustível da coluna L dá zero).
    distanciaKm = 0;
    frete = 0;
  } else {
    cidade = nomeCidade(entrada.cidade);
    const cot = lerCotacao(entrada.cotacao);
    const cotacaoValida = cot && soDigitos(entrada.cep).length === 8 && cot.cep === soDigitos(entrada.cep);
    // A promoção vale pela data de entrega: a da faixa agendada; para o pedido de hoje, a data de hoje.
    const dataEntrega =
      entrada.horario !== CHAVE_AGORA && /^\d{4}-\d{2}-\d{2}\|/.test(entrada.horario)
        ? entrada.horario.slice(0, 10)
        : data;
    const promo = cidade ? avaliarPromo({ cidade, quantidade, dataEntrega }) : null;
    if (cotacaoValida) {
      distanciaKm = cot.km1Decimal;
      frete = cot.valor;
    }
    if (promo?.gratis) frete = 0;
  }

  return {
    ok: true,
    corpo: {
      id: entrada.id,
      data,
      hora,
      cidade,
      distanciaKm,
      pagamento: planilha.pagamento[entrada.pagamento],
      status: planilha.status,
      frete,
      origem: planilha.origem,
      atendimento: planilha.atendimento[entrada.modalidade],
      relacao: "",
      comoConheceu: "",
      tipoRegistro: planilha.tipoRegistro,
      itens,
    },
  };
}

/** Usa o nome oficial quando a cidade é uma das atendidas ("mogi guacu" → "Mogi Guaçu"). */
function nomeCidade(digitada: string) {
  const alvo = normalizar(digitada);
  return loja.areaAtendida.find((c) => normalizar(c) === alvo) ?? digitada.trim();
}
