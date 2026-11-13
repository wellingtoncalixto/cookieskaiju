import "server-only";
import { loja } from "@/config/loja";
import { bancoConfigurado, obterBanco } from "@/server/db";

/**
 * Estoque por sabor (produtos.estoque; nulo = não controla).
 * - Pedido do site ou pendente lançado no admin: não mexe no estoque (pedido falso ou desistência não esgota o
 *   cardápio). Só fica marcado "sem estoque" se, na chegada, já faltavam unidades (aviso, sem baixar).
 * - Concluído (pelo admin, ou lançado já concluído): baixa as unidades (baixarEstoqueConcluido).
 * - Saiu de concluído (pendente, cancelado ou abandonado): devolve o que tinha baixado (devolverEstoquePedido).
 * - Pendentes antigos, de antes desta regra, reservaram ao chegar. O saldo dos movimentos do pedido mostra isso:
 *   continuam reservados enquanto pendentes, ao concluir não baixam de novo e, cancelados/abandonados, devolvem.
 * - Admin: informa a contagem (definirEstoque), registrada como ajuste.
 * Toda mudança vira uma linha em movimentos_estoque; o saldo por pedido evita baixar ou devolver duas vezes.
 */

/**
 * Baixa o estoque dos itens do pedido. Cada produto é atualizado numa única instrução condicional, então dois
 * pedidos ao mesmo tempo nunca vendem a mesma unidade. Devolve true se faltou unidade para algum item
 * (o pedido fica marcado como sem estoque e o que restava é zerado).
 */
export async function baixarEstoquePedido(
  pedidoId: string,
  itens: { produtoId: number; quantidade: number }[],
): Promise<boolean> {
  const db = obterBanco();
  let faltou = false;
  for (const i of itens) {
    const baixou = await db.consulta(
      `with b as (
         update produtos set estoque = estoque - $2
          where id = $1 and estoque is not null and estoque >= $2 returning id
       )
       insert into movimentos_estoque (produto_id, quantidade, motivo, pedido_id)
       select id, -$2, 'venda', $3 from b returning id`,
      [i.produtoId, i.quantidade, pedidoId],
    );
    if (baixou.length) continue;
    // Não havia o suficiente (ou o produto não controla estoque): zera o que restava, se controla.
    const zerou = await db.consulta<{ tirado: number }>(
      `with antes as (select estoque from produtos where id = $1 and estoque is not null),
            z as (update produtos set estoque = 0 where id = $1 and estoque is not null returning id),
            m as (
              insert into movimentos_estoque (produto_id, quantidade, motivo, pedido_id)
              select $1, -antes.estoque, 'venda', $2 from antes, z where antes.estoque > 0
            )
       select antes.estoque as tirado from antes, z`,
      [i.produtoId, pedidoId],
    );
    if (zerou.length) faltou = true;
  }
  return faltou;
}

/** Devolve ao estoque o que o pedido tinha baixado ou reservado (saldo dos movimentos dele; sem saldo, nada). */
export async function devolverEstoquePedido(pedidoId: string) {
  await obterBanco().consulta(
    `with saldo as (
       select produto_id, -sum(quantidade)::int as q from movimentos_estoque
        where pedido_id = $1 group by produto_id having sum(quantidade) < 0
     ),
     up as (
       update produtos p set estoque = p.estoque + saldo.q
         from saldo where p.id = saldo.produto_id and p.estoque is not null
       returning p.id, saldo.q
     )
     insert into movimentos_estoque (produto_id, quantidade, motivo, pedido_id)
     select id, q, 'cancelamento', $1 from up`,
    [pedidoId],
  );
}

/**
 * Pedido concluído: baixa as unidades dos itens, a não ser que ele já tenha saldo negativo (já baixado, ou pendente
 * antigo que reservou ao chegar). Devolve true se faltou unidade (e marca o pedido como sem estoque).
 */
export async function baixarEstoqueConcluido(pedidoId: string): Promise<boolean> {
  const db = obterBanco();
  const [r] = await db.consulta<{ baixado: boolean }>(
    `select exists (
       select 1 from movimentos_estoque where pedido_id = $1 group by produto_id having sum(quantidade) < 0
     ) as baixado`,
    [pedidoId],
  );
  if (r.baixado) return false;
  const itens = await db.consulta<{ produtoId: number; quantidade: number }>(
    `select produto_id as "produtoId", quantidade from itens_pedido where pedido_id = $1 and produto_id is not null`,
    [pedidoId],
  );
  const faltou = await baixarEstoquePedido(pedidoId, itens);
  if (faltou) await db.consulta("update pedidos set sem_estoque = true where id = $1", [pedidoId]);
  return faltou;
}

/** Contagem informada no admin (null = deixa de controlar). Registra a diferença como ajuste. */
export async function definirEstoque(produtoId: number, novo: number | null) {
  await obterBanco().consulta(
    `with antes as (select coalesce(estoque, 0) as e from produtos where id = $1),
          up as (update produtos set estoque = $2 where id = $1 returning id)
     insert into movimentos_estoque (produto_id, quantidade, motivo)
     select up.id, coalesce($2::int, 0) - antes.e, 'ajuste' from up, antes
      where $2::int is not null and coalesce($2::int, 0) <> antes.e`,
    [produtoId, novo],
  );
}

export type EstoqueSabor = {
  id: number;
  slug: string;
  nome: string;
  estoque: number | null;
  disponivel: boolean;
};

/** Estoque atual de cada sabor ativo (lido na hora, sem cache): usado na revisão do pedido. */
export async function estoqueAtual(): Promise<EstoqueSabor[]> {
  if (!bancoConfigurado())
    return loja.produtos.map((p, i) => ({
      id: i + 1,
      slug: p.slug,
      nome: p.nome,
      estoque: null,
      disponivel: p.disponivel,
    }));
  return obterBanco().consulta<EstoqueSabor>(
    `select id, slug, nome, estoque, (disponivel and (estoque is null or estoque > 0)) as disponivel
       from produtos where ativo order by ordem, id`,
  );
}
