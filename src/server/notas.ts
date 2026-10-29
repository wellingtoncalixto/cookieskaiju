import "server-only";
import { obterBanco } from "@/server/db";
import type { NotaLida } from "@/server/leitura-nota";
import { recalcularCustosProdutos } from "@/server/precificacao";

/**
 * Notas de compra: a IA lê, a nota fica como rascunho e o admin confere. Ao aplicar:
 * - cada item ligado a um insumo (ou marcado como insumo novo) atualiza o preço da embalagem;
 * - o total vira uma despesa no financeiro, ligada à nota;
 * - os custos dos sabores são recalculados.
 */

export type ItemNota = {
  id: number;
  descricao: string;
  quantidade: number;
  tamanhoEmbalagem: number | null;
  unidade: "g" | "ml" | "un" | null;
  valorTotal: number;
  insumoId: number | null;
  atualizarPreco: boolean;
};

export type Nota = {
  id: number;
  criadoEm: number;
  arquivoNome: string;
  fornecedor: string;
  data: string | null;
  total: number | null;
  categoria: string;
  status: "rascunho" | "aplicada" | "descartada";
  observacao: string;
  itens: ItemNota[];
};

export async function salvarRascunho(n: NotaLida, arquivoNome: string): Promise<number> {
  const [r] = await obterBanco().consulta<{ id: number }>(
    `with nota as (
       insert into notas_compra (arquivo_nome, fornecedor, data, total, observacao)
       values ($1, $2, $3::date, $4, $5) returning id
     ),
     itens as (
       insert into itens_nota (nota_id, ordem, descricao, quantidade, tamanho_embalagem, unidade, valor_total, insumo_id)
       select nota.id, i.ordem, i.descricao, i.quantidade, i.tamanho_embalagem, i.unidade, i.valor_total, i.insumo_id
         from nota, jsonb_to_recordset($6::jsonb)
           as i(ordem int, descricao text, quantidade numeric, tamanho_embalagem numeric, unidade text,
                valor_total numeric, insumo_id int)
     )
     select id from nota`,
    [
      arquivoNome.slice(0, 160),
      n.fornecedor,
      n.data,
      n.total,
      n.observacao,
      JSON.stringify(n.itens.map((i, ordem) => ({ ordem, ...i }))),
    ],
  );
  return r.id;
}

export async function obterNota(id: number): Promise<Nota | undefined> {
  const [n] = await obterBanco().consulta<Nota>(
    `select n.id, (extract(epoch from n.criado_em) * 1000)::float8 as "criadoEm", n.arquivo_nome as "arquivoNome",
            n.fornecedor, n.data::text as data, n.total::float8 as total, n.categoria, n.status, n.observacao,
            coalesce((select json_agg(json_build_object(
                'id', i.id, 'descricao', i.descricao, 'quantidade', i.quantidade::float8,
                'tamanhoEmbalagem', i.tamanho_embalagem::float8, 'unidade', i.unidade,
                'valorTotal', i.valor_total::float8, 'insumoId', i.insumo_id, 'atualizarPreco', i.atualizar_preco
              ) order by i.ordem, i.id) from itens_nota i where i.nota_id = n.id), '[]'::json) as itens
       from notas_compra n where n.id = $1`,
    [id],
  );
  return n;
}

export const listarNotas = () =>
  obterBanco().consulta<
    Pick<Nota, "id" | "fornecedor" | "data" | "total" | "status" | "arquivoNome"> & { itens: number }
  >(
    `select n.id, n.fornecedor, n.data::text as data, n.total::float8 as total, n.status, n.arquivo_nome as "arquivoNome",
            (select count(*)::int from itens_nota i where i.nota_id = n.id) as itens
       from notas_compra n order by n.criado_em desc limit 50`,
  );

/** O que o admin conferiu na tela. `insumo`: id de insumo, "novo" (criar) ou null (não é insumo). */
export type ConferenciaItem = {
  id: number;
  descricao: string;
  quantidade: number;
  tamanhoEmbalagem: number | null;
  unidade: "g" | "ml" | "un" | null;
  valorTotal: number;
  insumo: number | "novo" | null;
  atualizarPreco: boolean;
};

export type Conferencia = {
  fornecedor: string;
  data: string;
  total: number;
  categoria: string;
  itens: ConferenciaItem[];
};

export type ResultadoAplicacao = { atualizados: string[]; criados: string[]; avisos: string[] };

export async function aplicarNota(id: number, c: Conferencia): Promise<ResultadoAplicacao> {
  const db = obterBanco();
  const [nota] = await db.consulta<{ status: string }>("select status from notas_compra where id = $1", [id]);
  if (!nota) throw new Error("Nota não encontrada.");
  if (nota.status !== "rascunho") throw new Error("Esta nota já foi aplicada ou descartada.");
  const insumos = await db.consulta<{ id: number; nome: string; unidade: string }>(
    "select id, nome, unidade from insumos",
  );
  const r: ResultadoAplicacao = { atualizados: [], criados: [], avisos: [] };

  for (const it of c.itens) {
    let insumoId: number | null = typeof it.insumo === "number" ? it.insumo : null;
    const precoEmbalagem = it.quantidade > 0 ? it.valorTotal / it.quantidade : null;
    const completo = it.tamanhoEmbalagem != null && it.unidade != null && precoEmbalagem != null;

    if (it.insumo === "novo") {
      if (!completo) {
        r.avisos.push(`"${it.descricao}": informe tamanho e unidade da embalagem para criar o insumo.`);
      } else {
        const [novo] = await db.consulta<{ id: number }>(
          `insert into insumos (nome, unidade, embalagem_qtd, embalagem_preco) values ($1, $2, $3, $4)
           on conflict (nome) do update set unidade = excluded.unidade, embalagem_qtd = excluded.embalagem_qtd,
             embalagem_preco = excluded.embalagem_preco, atualizado_em = now()
           returning id`,
          [it.descricao, it.unidade, it.tamanhoEmbalagem, Math.round(precoEmbalagem! * 100) / 100],
        );
        insumoId = novo.id;
        r.criados.push(it.descricao);
      }
    } else if (insumoId != null && it.atualizarPreco) {
      const ins = insumos.find((x) => x.id === insumoId);
      if (!ins) r.avisos.push(`"${it.descricao}": insumo não encontrado.`);
      else if (!completo)
        r.avisos.push(`"${it.descricao}": sem tamanho da embalagem, preço de ${ins.nome} não mudou.`);
      else if (ins.unidade !== it.unidade)
        r.avisos.push(
          `"${it.descricao}" está em ${it.unidade} e ${ins.nome} em ${ins.unidade}: preço não mudou.`,
        );
      else {
        await db.consulta(
          `update insumos set embalagem_qtd = $2, embalagem_preco = $3, atualizado_em = now() where id = $1`,
          [insumoId, it.tamanhoEmbalagem, Math.round(precoEmbalagem! * 100) / 100],
        );
        r.atualizados.push(ins.nome);
      }
    }
    await db.consulta(
      `update itens_nota set descricao = $2, quantidade = $3, tamanho_embalagem = $4, unidade = $5, valor_total = $6,
              insumo_id = $7, atualizar_preco = $8
        where id = $1 and nota_id = $9`,
      [
        it.id,
        it.descricao,
        it.quantidade,
        it.tamanhoEmbalagem,
        it.unidade,
        it.valorTotal,
        insumoId,
        it.atualizarPreco,
        id,
      ],
    );
  }

  await db.consulta(
    `update notas_compra set fornecedor = $2, data = $3::date, total = $4, categoria = $5, status = 'aplicada',
            aplicada_em = now() where id = $1`,
    [id, c.fornecedor, c.data, c.total, c.categoria],
  );
  await db.consulta(
    `insert into despesas (data, categoria, descricao, valor, nota_id) values ($1::date, $2, $3, $4, $5)`,
    [c.data, c.categoria, `Nota de compra${c.fornecedor ? ` — ${c.fornecedor}` : ""}`, c.total, id],
  );
  await recalcularCustosProdutos();
  return r;
}

export async function descartarNota(id: number) {
  await obterBanco().consulta(
    "update notas_compra set status = 'descartada' where id = $1 and status = 'rascunho'",
    [id],
  );
}
