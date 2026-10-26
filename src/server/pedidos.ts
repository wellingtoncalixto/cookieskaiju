import "server-only";
import { z } from "zod";
import { loja } from "@/config/loja";
import { CHAVE_AGORA } from "@/lib/agenda";
import type { Cotacao } from "@/lib/assinatura";
import { normalizar, soDigitos } from "@/lib/formato";
import { avaliarPromo } from "@/lib/frete";
import { idPedidoValido } from "@/lib/id-pedido";
import { isoData, paredeSP } from "@/lib/tempo";
import { calcularValoresPedido } from "@/lib/valores-pedido";
import { configCustos, mapaConfiguracao } from "@/server/configuracao";
import { epochMs, obterBanco } from "@/server/db";
import { baixarEstoquePedido, devolverEstoquePedido, rebaixarEstoquePedido } from "@/server/estoque";

/**
 * O que o navegador manda para /api/pedidos. Sem nome, telefone, endereço nem mensagem:
 * só o necessário para a operação e os indicadores.
 */
export const esquemaEntrada = z.object({
  id: z.string().refine(idPedidoValido, { error: "id inválido" }),
  modalidade: z.enum(["entrega", "retirada"]),
  /** "agora" ou "AAAA-MM-DD|faixa". */
  horario: z.string().regex(/^(agora|\d{4}-\d{2}-\d{2}\|[\w-]{1,20})$/),
  itens: z
    .array(z.object({ slug: z.string().max(60), quantidade: z.number().int().min(1).max(50) }))
    .min(1)
    .max(20),
  pagamento: z.enum(["pix", "credito", "debito", "dinheiro"]),
  cidade: z.string().trim().max(80).default(""),
  cep: z.string().max(9).default(""),
  /** Cotação de frete assinada por /api/frete (sem ela, frete e distância ficam a confirmar). */
  cotacao: z.string().max(600).optional(),
});
export type EntradaPedido = z.infer<typeof esquemaEntrada>;

export type ResultadoRegistro =
  { ok: true; duplicado: boolean; semEstoque: boolean } | { ok: false; erro: string };

type ProdutoBanco = {
  id: number;
  slug: string;
  nome: string;
  preco: number;
  custo: number | null;
  disponivel: boolean;
};

/**
 * Valida e recalcula o pedido no servidor e grava pedido + itens numa única instrução (atômica):
 * - preço e custo vêm do banco (o navegador só diz sabores e quantidades);
 * - o frete só é aceito com cotação assinada que bate com o CEP; a promoção é recalculada aqui;
 * - data e hora são do servidor; o mesmo ID nunca grava duas vezes (clique duplo, nova tentativa).
 */
export async function registrarPedido(
  entrada: EntradaPedido,
  agora: number,
  lerCotacao: (token: string | undefined) => Cotacao | null,
): Promise<ResultadoRegistro> {
  const db = obterBanco();
  const slugs = entrada.itens.map((i) => i.slug);
  if (new Set(slugs).size !== slugs.length) return { ok: false, erro: "produto_repetido" };
  const produtos = await db.consulta<ProdutoBanco>(
    `select id, slug, nome, preco::float8 as preco, custo_unitario::float8 as custo, disponivel
       from produtos where ativo and slug = any($1)`,
    [slugs],
  );
  const porSlug = new Map(produtos.map((p) => [p.slug, p]));
  const itens = [];
  for (const i of entrada.itens) {
    const p = porSlug.get(i.slug);
    if (!p) return { ok: false, erro: "produto_desconhecido" };
    // Esgotado não recusa: o pedido já foi pelo WhatsApp. Ele entra marcado "sem estoque" para a loja resolver.
    itens.push({ produto: p, quantidade: i.quantidade });
  }
  const quantidade = itens.reduce((s, i) => s + i.quantidade, 0);

  const hoje = isoData(paredeSP(agora));
  const agendado = entrada.horario !== CHAVE_AGORA;
  const entregaData = agendado ? entrada.horario.slice(0, 10) : hoje;
  const entregaFaixa = agendado ? entrada.horario.slice(11) : CHAVE_AGORA;

  let cidade = "";
  let distanciaKm: number | null = null;
  let frete: number | null = null;
  if (entrada.modalidade === "retirada") {
    distanciaKm = 0;
    frete = 0;
  } else {
    cidade = nomeCidade(entrada.cidade);
    const cot = lerCotacao(entrada.cotacao);
    const cep = soDigitos(entrada.cep);
    if (cot && cep.length === 8 && cot.cep === cep) {
      distanciaKm = cot.km1Decimal;
      frete = cot.valor;
    }
    // A promoção vale pela data de entrega.
    if (cidade && avaliarPromo({ cidade, quantidade, dataEntrega: entregaData })?.gratis) frete = 0;
  }

  const v = calcularValoresPedido(
    {
      itens: itens.map((i) => ({ quantidade: i.quantidade, preco: i.produto.preco, custo: i.produto.custo })),
      modalidade: entrada.modalidade,
      pagamento: entrada.pagamento,
      frete,
      distanciaKm,
    },
    configCustos(await mapaConfiguracao()),
  );

  const gravados = await db.consulta<{ pedido_id: string }>(
    `with novo as (
       insert into pedidos (id, criado_em, entrega_data, entrega_faixa, modalidade, cidade, distancia_km, pagamento,
                            quantidade_cookies, receita_cookies, frete, custo_cookies, embalagem, taxa_pagamento,
                            combustivel, contribuicao, origem, tipo_registro)
       values ($1, to_timestamp($2::float8 / 1000), $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
               $16, 'site', 'site')
       on conflict (id) do nothing
       returning id
     )
     insert into itens_pedido (pedido_id, produto_id, produto_nome, quantidade, preco_unitario, custo_unitario)
     select novo.id, i.produto_id, i.produto_nome, i.quantidade, i.preco_unitario, i.custo_unitario
       from novo,
            jsonb_to_recordset($17::jsonb)
              as i(produto_id int, produto_nome text, quantidade int, preco_unitario numeric, custo_unitario numeric)
     returning pedido_id`,
    [
      entrada.id,
      agora,
      entregaData,
      entregaFaixa,
      entrada.modalidade,
      cidade,
      distanciaKm,
      entrada.pagamento,
      v.quantidade,
      v.receita,
      frete,
      v.custo,
      v.embalagem,
      v.taxa,
      v.combustivel,
      v.contribuicao,
      JSON.stringify(
        itens.map((i) => ({
          produto_id: i.produto.id,
          produto_nome: i.produto.nome,
          quantidade: i.quantidade,
          preco_unitario: i.produto.preco,
          custo_unitario: i.produto.custo,
        })),
      ),
    ],
  );
  if (gravados.length === 0) return { ok: true, duplicado: true, semEstoque: false };

  // Reserva as unidades (cada produto numa instrução condicional: nunca vende a mesma unidade duas vezes).
  const faltou =
    (await baixarEstoquePedido(
      entrada.id,
      itens.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade })),
    )) || itens.some((i) => !i.produto.disponivel);
  if (faltou) await db.consulta("update pedidos set sem_estoque = true where id = $1", [entrada.id]);
  return { ok: true, duplicado: false, semEstoque: faltou };
}

/** Usa o nome oficial quando a cidade é uma das atendidas ("mogi guacu" → "Mogi Guaçu"). */
function nomeCidade(digitada: string) {
  const alvo = normalizar(digitada);
  return loja.areaAtendida.find((c) => normalizar(c) === alvo) ?? digitada.trim();
}

// ---------------------------------------------------------------- leitura e status (admin)

export const STATUS = ["pendente", "concluido", "cancelado", "abandonado"] as const;
export type StatusPedido = (typeof STATUS)[number];

export type PedidoOperacao = {
  id: string;
  criadoEm: number;
  entregaData: string | null;
  entregaFaixa: string | null;
  modalidade: "entrega" | "retirada" | null;
  cidade: string;
  pagamento: string | null;
  status: StatusPedido;
  semEstoque: boolean;
  receita: number;
  frete: number | null;
  total: number;
  itens: { nome: string; quantidade: number; preco: number }[];
};

/** Pedidos com entrega de hoje em diante (São Paulo), na ordem de entrega. */
export async function pedidosDaOperacao(hoje: string): Promise<PedidoOperacao[]> {
  return obterBanco().consulta<PedidoOperacao>(
    `select p.id, ${epochMs("p.criado_em")} as "criadoEm", p.entrega_data::text as "entregaData",
            p.entrega_faixa as "entregaFaixa", p.modalidade, p.cidade, p.pagamento, p.status,
            p.sem_estoque as "semEstoque", p.receita_cookies::float8 as receita, p.frete::float8 as frete,
            (p.receita_cookies + coalesce(p.frete, 0))::float8 as total,
            coalesce((select json_agg(json_build_object('nome', i.produto_nome, 'quantidade', i.quantidade,
                                                         'preco', i.preco_unitario::float8) order by i.id)
                        from itens_pedido i where i.pedido_id = p.id), '[]'::json) as itens
       from pedidos p
      where p.entrega_data >= $1::date
      order by p.entrega_data, (p.entrega_faixa <> 'agora'), p.entrega_faixa, p.criado_em`,
    [hoje],
  );
}

const INATIVOS: StatusPedido[] = ["cancelado", "abandonado"];

/** Muda o status. Cancelado/abandonado devolve o estoque reservado; reativado reserva de novo. */
export async function mudarStatus(id: string, status: StatusPedido): Promise<boolean> {
  const [r] = await obterBanco().consulta<{ antes: StatusPedido }>(
    `with antes as (select status from pedidos where id = $1),
          up as (update pedidos set status = $2, status_em = now() where id = $1 returning id)
     select antes.status as antes from antes, up`,
    [id, status],
  );
  if (!r) return false;
  const eraInativo = INATIVOS.includes(r.antes);
  const ficaInativo = INATIVOS.includes(status);
  if (!eraInativo && ficaInativo) await devolverEstoquePedido(id);
  if (eraInativo && !ficaInativo) await rebaixarEstoquePedido(id);
  return true;
}
