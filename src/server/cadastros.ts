import "server-only";
import { obterBanco } from "@/server/db";
import { recalcularCustosProdutos } from "@/server/precificacao";

// ---------------------------------------------------------------- produtos

export type ProdutoAdmin = {
  id: number;
  slug: string;
  nome: string;
  destaque: string;
  descricao: string;
  alt: string;
  preco: number;
  disponivel: boolean;
  ativo: boolean;
  ordem: number;
  foto: string | null;
  cartaz: string | null;
  receitaId: number | null;
  custo: number | null;
  estoque: number | null;
};

const COLUNAS_PRODUTO = `id, slug, nome, destaque, descricao, alt, preco::float8 as preco, disponivel, ativo, ordem,
  foto_url as foto, cartaz_url as cartaz, receita_id as "receitaId", custo_unitario::float8 as custo, estoque`;

export const listarProdutos = () =>
  obterBanco().consulta<ProdutoAdmin>(
    `select ${COLUNAS_PRODUTO} from produtos order by ativo desc, ordem, id`,
  );

export async function obterProduto(id: number) {
  return (
    await obterBanco().consulta<ProdutoAdmin>(`select ${COLUNAS_PRODUTO} from produtos where id = $1`, [id])
  )[0];
}

export type DadosProduto = Omit<ProdutoAdmin, "id" | "custo" | "estoque">;

/** Cria (id nulo) ou atualiza. Mudou o preço: registra no histórico. Mudou a receita: recalcula o custo. */
export async function salvarProduto(id: number | null, d: DadosProduto): Promise<number> {
  const db = obterBanco();
  const valores = [
    d.slug,
    d.nome,
    d.destaque,
    d.descricao,
    d.alt,
    d.preco,
    d.disponivel,
    d.ativo,
    d.ordem,
    d.foto,
    d.cartaz,
    d.receitaId,
  ];
  let novoId: number;
  if (id == null) {
    const [r] = await db.consulta<{ id: number }>(
      `insert into produtos (slug, nome, destaque, descricao, alt, preco, disponivel, ativo, ordem, foto_url, cartaz_url, receita_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
      valores,
    );
    novoId = r.id;
  } else {
    await db.consulta(
      `with antes as (select preco from produtos where id = $13),
            depois as (
              update produtos set slug = $1, nome = $2, destaque = $3, descricao = $4, alt = $5, preco = $6,
                     disponivel = $7, ativo = $8, ordem = $9, foto_url = $10, cartaz_url = $11, receita_id = $12,
                     atualizado_em = now()
               where id = $13 returning id, preco, custo_unitario
            )
       insert into custos_historico (produto_id, custo_unitario, preco)
       select depois.id, depois.custo_unitario, depois.preco from depois, antes where antes.preco <> depois.preco`,
      [...valores, id],
    );
    novoId = id;
  }
  await recalcularCustosProdutos();
  if (id == null)
    await db.consulta(
      `insert into custos_historico (produto_id, custo_unitario, preco)
       select id, custo_unitario, preco from produtos
        where id = $1 and not exists (select 1 from custos_historico where produto_id = $1)`,
      [novoId],
    );
  return novoId;
}

// ---------------------------------------------------------------- insumos

export type DadosInsumo = {
  nome: string;
  unidade: "g" | "ml" | "un";
  embalagemQtd: number;
  embalagemPreco: number;
};

export async function salvarInsumo(id: number | null, d: DadosInsumo) {
  const db = obterBanco();
  const v = [d.nome, d.unidade, d.embalagemQtd, d.embalagemPreco];
  if (id == null)
    await db.consulta(
      "insert into insumos (nome, unidade, embalagem_qtd, embalagem_preco) values ($1, $2, $3, $4)",
      v,
    );
  else
    await db.consulta(
      `update insumos set nome = $1, unidade = $2, embalagem_qtd = $3, embalagem_preco = $4, atualizado_em = now()
        where id = $5`,
      [...v, id],
    );
  await recalcularCustosProdutos();
}

/** Só exclui insumo que não está em nenhuma receita. */
export async function excluirInsumo(id: number): Promise<boolean> {
  const db = obterBanco();
  const usos = await db.consulta("select 1 from receita_ingredientes where insumo_id = $1 limit 1", [id]);
  if (usos.length) return false;
  await db.consulta("delete from insumos where id = $1", [id]);
  return true;
}

// ---------------------------------------------------------------- receitas

export type DadosReceita = {
  nome: string;
  tipo: "sabor" | "base";
  rendimento: number;
  unidadeRendimento: "un" | "g";
  maoDeObraPct: number;
  usaForno: boolean;
};

export async function salvarReceita(id: number | null, d: DadosReceita): Promise<number> {
  const db = obterBanco();
  const v = [d.nome, d.tipo, d.rendimento, d.unidadeRendimento, d.maoDeObraPct, d.usaForno];
  let rid = id;
  if (rid == null) {
    const [r] = await db.consulta<{ id: number }>(
      `insert into receitas (nome, tipo, rendimento, unidade_rendimento, mao_de_obra_pct, usa_forno)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      v,
    );
    rid = r.id;
  } else {
    await db.consulta(
      `update receitas set nome = $1, tipo = $2, rendimento = $3, unidade_rendimento = $4, mao_de_obra_pct = $5,
              usa_forno = $6, atualizado_em = now() where id = $7`,
      [...v, rid],
    );
  }
  await recalcularCustosProdutos();
  return rid;
}

/** Só exclui receita que não é usada por outra receita nem ligada a produto. */
export async function excluirReceita(id: number): Promise<boolean> {
  const db = obterBanco();
  const usos = await db.consulta(
    `select 1 from receita_ingredientes where sub_receita_id = $1
     union all select 1 from produtos where receita_id = $1 limit 1`,
    [id],
  );
  if (usos.length) return false;
  await db.consulta("delete from receitas where id = $1", [id]);
  return true;
}

export async function adicionarIngrediente(
  receitaId: number,
  item: { insumoId: number | null; subReceitaId: number | null; quantidade: number },
) {
  await obterBanco().consulta(
    "insert into receita_ingredientes (receita_id, insumo_id, sub_receita_id, quantidade) values ($1, $2, $3, $4)",
    [receitaId, item.insumoId, item.subReceitaId, item.quantidade],
  );
  await recalcularCustosProdutos();
}

export async function alterarIngrediente(id: number, quantidade: number) {
  await obterBanco().consulta("update receita_ingredientes set quantidade = $2 where id = $1", [
    id,
    quantidade,
  ]);
  await obterBanco().consulta(
    "update receitas set atualizado_em = now() where id = (select receita_id from receita_ingredientes where id = $1)",
    [id],
  );
  await recalcularCustosProdutos();
}

export async function removerIngrediente(id: number) {
  await obterBanco().consulta("delete from receita_ingredientes where id = $1", [id]);
  await recalcularCustosProdutos();
}

export type IngredienteAdmin = {
  id: number;
  receitaId: number;
  insumoId: number | null;
  subReceitaId: number | null;
  quantidade: number;
};

export const listarIngredientes = () =>
  obterBanco().consulta<IngredienteAdmin>(
    `select id, receita_id as "receitaId", insumo_id as "insumoId", sub_receita_id as "subReceitaId",
            quantidade::float8 as quantidade
       from receita_ingredientes order by id`,
  );

// ---------------------------------------------------------------- configuração

export async function salvarConfiguracao(valores: Record<string, number | null>) {
  const db = obterBanco();
  for (const [chave, valor] of Object.entries(valores))
    await db.consulta(
      `insert into configuracao (chave, valor) values ($1, $2)
       on conflict (chave) do update set valor = excluded.valor`,
      [chave, valor],
    );
  await recalcularCustosProdutos();
}
