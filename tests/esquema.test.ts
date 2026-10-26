import { describe, expect, it } from "vitest";
import { bancoDeTeste } from "./apoio/banco";

describe("esquema do banco", () => {
  it("aplica as migrações e cria as views do painel", async () => {
    const b = await bancoDeTeste();
    const views = await b.consulta<{ table_name: string }>(
      "select table_name from information_schema.views where table_schema = 'public' order by 1",
    );
    expect(views.map((v) => v.table_name)).toEqual([
      "painel_funil",
      "painel_modalidade",
      "painel_origem",
      "painel_resumo",
      "painel_vendas_por_sabor",
      "vw_estoque",
      "vw_pedidos",
    ]);
  });

  it("recusa ingrediente que não é insumo nem sub-receita", async () => {
    const b = await bancoDeTeste();
    await b.consulta(
      "insert into receitas (nome, tipo, rendimento, unidade_rendimento) values ('X', 'sabor', 15, 'un')",
    );
    await expect(
      b.consulta("insert into receita_ingredientes (receita_id, quantidade) values (1, 10)"),
    ).rejects.toThrow();
  });
});
