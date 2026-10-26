import "server-only";
import { calcularReceitas, type CustoReceita, type Insumo, type Receita } from "@/lib/precificacao";
import { mapaConfiguracao, parametrosForno } from "@/server/configuracao";
import { obterBanco } from "@/server/db";

export type DadosPrecificacao = {
  insumos: (Insumo & { atualizadoEm: number })[];
  receitas: Receita[];
  custos: Map<number, CustoReceita>;
};

export async function carregarPrecificacao(): Promise<DadosPrecificacao> {
  const db = obterBanco();
  const [insumos, receitas, ingredientes, cfg] = await Promise.all([
    db.consulta<Insumo & { atualizadoEm: number }>(
      `select id, nome, unidade, embalagem_qtd::float8 as "embalagemQtd", embalagem_preco::float8 as "embalagemPreco",
              (extract(epoch from atualizado_em) * 1000)::float8 as "atualizadoEm"
         from insumos order by nome`,
    ),
    db.consulta<Omit<Receita, "ingredientes">>(
      `select id, nome, tipo, rendimento::float8 as rendimento, unidade_rendimento as "unidadeRendimento",
              mao_de_obra_pct::float8 as "maoDeObraPct", usa_forno as "usaForno"
         from receitas order by tipo, nome`,
    ),
    db.consulta<{
      receitaId: number;
      insumoId: number | null;
      subReceitaId: number | null;
      quantidade: number;
    }>(
      `select receita_id as "receitaId", insumo_id as "insumoId", sub_receita_id as "subReceitaId",
              quantidade::float8 as quantidade
         from receita_ingredientes order by id`,
    ),
    mapaConfiguracao(),
  ]);
  const completas: Receita[] = receitas.map((r) => ({
    ...r,
    ingredientes: ingredientes
      .filter((i) => i.receitaId === r.id)
      .map(({ insumoId, subReceitaId, quantidade }) => ({ insumoId, subReceitaId, quantidade })),
  }));
  return { insumos, receitas: completas, custos: calcularReceitas(insumos, completas, parametrosForno(cfg)) };
}

/**
 * Recalcula o custo final de cada produto a partir da receita ligada a ele e grava em `produtos.custo_unitario`.
 * Quando o custo (ou o preço) muda, registra uma linha em `custos_historico`.
 */
export async function recalcularCustosProdutos(): Promise<void> {
  const db = obterBanco();
  const { custos } = await carregarPrecificacao();
  const produtos = await db.consulta<{ id: number; receitaId: number | null }>(
    `select id, receita_id as "receitaId" from produtos`,
  );
  for (const p of produtos) {
    const custo = p.receitaId == null ? null : (custos.get(p.receitaId)?.final ?? null);
    await db.consulta(
      `with depois as (
              update produtos set custo_unitario = round($2::numeric, 4)
               where id = $1 and custo_unitario is distinct from round($2::numeric, 4)
               returning id, custo_unitario, preco
            )
       insert into custos_historico (produto_id, custo_unitario, preco)
       select id, custo_unitario, preco from depois`,
      [p.id, custo],
    );
  }
}
