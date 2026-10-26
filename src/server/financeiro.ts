import "server-only";
import { obterBanco } from "@/server/db";

/**
 * Financeiro de um período (datas de entrega, AAAA-MM-DD, inclusive).
 * Vendas = pedidos concluídos. Resultado = contribuição dos pedidos − despesas do período.
 */

export type ResumoFinanceiro = {
  pedidos: number;
  cookies: number;
  receitaCookies: number;
  frete: number;
  faturamento: number;
  custoCookies: number;
  embalagem: number;
  taxas: number;
  combustivel: number;
  contribuicao: number;
  /** Concluídos sem contribuição calculada (frete a confirmar ou custo desconhecido). */
  semContribuicao: number;
  pendentes: number;
  valorPendente: number;
  perdidos: number;
  despesas: number;
};

export type LinhaQuebra = {
  chave: string;
  pedidos: number;
  cookies: number;
  valor: number;
  contribuicao: number | null;
};
export type LinhaSabor = { sabor: string; cookies: number; receita: number; custo: number | null };
export type Despesa = { id: number; data: string; categoria: string; descricao: string; valor: number };

export const CATEGORIAS_DESPESA = [
  "Insumos",
  "Embalagens",
  "Marketing",
  "Gás e energia",
  "Transporte",
  "Equipamentos",
  "Taxas e impostos",
  "Outros",
] as const;

const periodo = "p.entrega_data between $1::date and $2::date";

export async function resumoFinanceiro(de: string, ate: string): Promise<ResumoFinanceiro> {
  const db = obterBanco();
  const [[r], [d]] = await Promise.all([
    db.consulta<Omit<ResumoFinanceiro, "despesas">>(
      `select
         count(*) filter (where status = 'concluido')::int as pedidos,
         coalesce(sum(quantidade_cookies) filter (where status = 'concluido'), 0)::int as cookies,
         coalesce(sum(receita_cookies) filter (where status = 'concluido'), 0)::float8 as "receitaCookies",
         coalesce(sum(frete) filter (where status = 'concluido'), 0)::float8 as frete,
         coalesce(sum(receita_cookies + coalesce(frete, 0)) filter (where status = 'concluido'), 0)::float8
           as faturamento,
         coalesce(sum(custo_cookies) filter (where status = 'concluido'), 0)::float8 as "custoCookies",
         coalesce(sum(embalagem) filter (where status = 'concluido'), 0)::float8 as embalagem,
         coalesce(sum(taxa_pagamento) filter (where status = 'concluido'), 0)::float8 as taxas,
         coalesce(sum(combustivel) filter (where status = 'concluido'), 0)::float8 as combustivel,
         coalesce(sum(contribuicao) filter (where status = 'concluido'), 0)::float8 as contribuicao,
         count(*) filter (where status = 'concluido' and contribuicao is null)::int as "semContribuicao",
         count(*) filter (where status = 'pendente')::int as pendentes,
         coalesce(sum(receita_cookies + coalesce(frete, 0)) filter (where status = 'pendente'), 0)::float8
           as "valorPendente",
         count(*) filter (where status in ('cancelado', 'abandonado'))::int as perdidos
       from pedidos p where ${periodo}`,
      [de, ate],
    ),
    db.consulta<{ total: number }>(
      "select coalesce(sum(valor), 0)::float8 as total from despesas where data between $1::date and $2::date",
      [de, ate],
    ),
  ]);
  return { ...r, despesas: d.total };
}

/** Vendas concluídas agrupadas por modalidade, pagamento ou origem. */
export async function quebra(coluna: "modalidade" | "pagamento" | "origem", de: string, ate: string) {
  return obterBanco().consulta<LinhaQuebra>(
    `select coalesce(${coluna}, 'não informado') as chave, count(*)::int as pedidos,
            sum(quantidade_cookies)::int as cookies,
            sum(receita_cookies + coalesce(frete, 0))::float8 as valor,
            sum(contribuicao)::float8 as contribuicao
       from pedidos p where status = 'concluido' and ${periodo}
      group by 1 order by valor desc`,
    [de, ate],
  );
}

export async function vendasPorSabor(de: string, ate: string) {
  return obterBanco().consulta<LinhaSabor>(
    `select i.produto_nome as sabor, sum(i.quantidade)::int as cookies,
            sum(i.quantidade * i.preco_unitario)::float8 as receita,
            sum(i.quantidade * i.custo_unitario)::float8 as custo
       from itens_pedido i join pedidos p on p.id = i.pedido_id
      where p.status = 'concluido' and ${periodo}
      group by 1 order by cookies desc`,
    [de, ate],
  );
}

export async function listarDespesas(de: string, ate: string) {
  return obterBanco().consulta<Despesa>(
    `select id, data::text as data, categoria, descricao, valor::float8 as valor
       from despesas where data between $1::date and $2::date order by data desc, id desc`,
    [de, ate],
  );
}

export async function adicionarDespesa(d: Omit<Despesa, "id">) {
  await obterBanco().consulta(
    "insert into despesas (data, categoria, descricao, valor) values ($1::date, $2, $3, $4)",
    [d.data, d.categoria, d.descricao, d.valor],
  );
}

export async function excluirDespesa(id: number) {
  await obterBanco().consulta("delete from despesas where id = $1", [id]);
}
