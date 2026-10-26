import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usarBanco } from "@/server/db";
import { sanearNota, type NotaLida } from "@/server/leitura-nota";
import { aplicarNota, obterNota, salvarRascunho } from "@/server/notas";
import { bancoDeTeste } from "./apoio/banco";

// Dados fictícios (o repositório é público).
const lida: NotaLida = {
  legivel: true,
  fornecedor: "Atacado Exemplo",
  data: "2026-10-20",
  total: 95.5,
  observacao: "",
  itens: [
    {
      descricao: "Manteiga 500g",
      quantidade: 2,
      tamanho_embalagem: 500,
      unidade: "g",
      valor_total: 44,
      insumo_id: 1,
    },
    {
      descricao: "Ovos c/30",
      quantidade: 1,
      tamanho_embalagem: 30,
      unidade: "un",
      valor_total: 21.5,
      insumo_id: 2,
    },
    {
      descricao: "Fita de cetim",
      quantidade: 1,
      tamanho_embalagem: 10,
      unidade: "un",
      valor_total: 30,
      insumo_id: null,
    },
  ],
};

describe("notas de compra", () => {
  let b: Awaited<ReturnType<typeof bancoDeTeste>>;
  beforeEach(async () => {
    b = await bancoDeTeste();
    await b.consulta(`insert into insumos (id, nome, unidade, embalagem_qtd, embalagem_preco) values
      (1, 'Manteiga', 'g', 500, 20), (2, 'Ovo', 'g', 60, 0.5)`);
    await b.consulta("select setval('insumos_id_seq', 2)");
    usarBanco(b);
  });
  afterEach(() => usarBanco(null));

  it("saneia a leitura: descarta insumo inexistente e data inválida", () => {
    const s = sanearNota(
      { ...lida, data: "20/10/2026", itens: [{ ...lida.itens[0], insumo_id: 99, valor_total: 44.567 }] },
      [{ id: 1, nome: "Manteiga", unidade: "g" }],
    );
    expect(s.data).toBeNull();
    expect(s.itens[0]).toMatchObject({ insumo_id: null, valor_total: 44.57 });
  });

  it("aplica: atualiza o preço, cria insumo novo, avisa unidade diferente e lança a despesa", async () => {
    const id = await salvarRascunho(lida, "nota.jpg");
    const nota = (await obterNota(id))!;
    expect(nota.itens.map((i) => i.descricao)).toEqual(["Manteiga 500g", "Ovos c/30", "Fita de cetim"]);
    const r = await aplicarNota(id, {
      fornecedor: nota.fornecedor,
      data: "2026-10-20",
      total: 95.5,
      categoria: "Insumos",
      itens: nota.itens.map((i) => ({
        ...i,
        insumo: i.descricao === "Fita de cetim" ? ("novo" as const) : i.insumoId,
      })),
    });
    expect(r.atualizados).toEqual(["Manteiga"]);
    expect(r.criados).toEqual(["Fita de cetim"]);
    expect(r.avisos[0]).toMatch(/un.*Ovo.*g/);

    const ins = await b.consulta(
      "select nome, embalagem_qtd::float8 as q, embalagem_preco::float8 as p from insumos order by id",
    );
    expect(ins).toEqual([
      { nome: "Manteiga", q: 500, p: 22 }, // 44 ÷ 2 embalagens
      { nome: "Ovo", q: 60, p: 0.5 }, // unidade diferente: não mudou
      { nome: "Fita de cetim", q: 10, p: 30 },
    ]);
    const desp = await b.consulta("select categoria, valor::float8 as valor, nota_id from despesas");
    expect(desp).toEqual([{ categoria: "Insumos", valor: 95.5, nota_id: id }]);
    expect((await obterNota(id))!.status).toBe("aplicada");

    // Não aplica duas vezes (despesa em dobro).
    await expect(
      aplicarNota(id, { fornecedor: "", data: "2026-10-20", total: 1, categoria: "Insumos", itens: [] }),
    ).rejects.toThrow(/já foi aplicada/);
  });
});
