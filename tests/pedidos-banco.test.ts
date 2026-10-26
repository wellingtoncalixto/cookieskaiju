import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usarBanco } from "@/server/db";
import { mudarStatus, pedidosDaOperacao, registrarPedido, type EntradaPedido } from "@/server/pedidos";
import { bancoDeTeste } from "./apoio/banco";

// Dados fictícios (o repositório é público).
const AGORA = Date.parse("2026-10-24T15:00:00-03:00"); // sábado, 15h em São Paulo
const sem = () => null;

async function preparar() {
  const b = await bancoDeTeste();
  await b.consulta(`insert into produtos (slug, nome, preco, custo_unitario, ordem) values
    ('alfa', 'Alfa', 18, 6, 1), ('beta', 'Beta', 20, 7, 2)`);
  await b.consulta(`insert into produtos (slug, nome, preco, disponivel) values ('gama', 'Gama', 22, false)`);
  await b.consulta(`insert into configuracao (chave, valor) values
    ('kraft_preco', 1.5), ('kraft_cookies_por_saco', 5), ('flyer_aquecimento', 0.7), ('flyer_marca', 0.91),
    ('moto_km_por_litro', 20), ('gasolina_litro', 6.6), ('taxa_pix', 0), ('taxa_credito', 0.0315),
    ('taxa_debito', 0.0137), ('taxa_dinheiro', 0)`);
  usarBanco(b);
  return b;
}

const base: EntradaPedido = {
  id: "CK-261024-AAAAAAA",
  modalidade: "retirada",
  horario: "agora",
  itens: [{ slug: "alfa", quantidade: 2 }],
  pagamento: "pix",
  cidade: "",
  cep: "",
};

describe("registro de pedidos no banco", () => {
  let b: Awaited<ReturnType<typeof preparar>>;
  beforeEach(async () => {
    b = await preparar();
  });
  afterEach(() => usarBanco(null));

  it("grava pedido e itens com preço e custo do banco", async () => {
    const r = await registrarPedido(
      {
        ...base,
        itens: [
          { slug: "alfa", quantidade: 2 },
          { slug: "beta", quantidade: 1 },
        ],
      },
      AGORA,
      sem,
    );
    expect(r).toEqual({ ok: true, duplicado: false });
    const [p] = await b.consulta<Record<string, unknown>>(
      `select entrega_data::text as d, entrega_faixa, quantidade_cookies, receita_cookies::float8 as receita,
              frete::float8 as frete, custo_cookies::float8 as custo, combustivel::float8 as comb, status, tipo_registro
         from pedidos`,
    );
    expect(p).toMatchObject({
      d: "2026-10-24",
      entrega_faixa: "agora",
      quantidade_cookies: 3,
      receita: 56,
      frete: 0,
      custo: 19,
      comb: 0,
      status: "pendente",
      tipo_registro: "site",
    });
    const itens = await b.consulta(
      "select produto_nome, quantidade, preco_unitario::float8 as preco from itens_pedido order by id",
    );
    expect(itens).toEqual([
      { produto_nome: "Alfa", quantidade: 2, preco: 18 },
      { produto_nome: "Beta", quantidade: 1, preco: 20 },
    ]);
  });

  it("mesmo ID duas vezes (inclusive ao mesmo tempo): grava uma vez só", async () => {
    const [a, c] = await Promise.all([registrarPedido(base, AGORA, sem), registrarPedido(base, AGORA, sem)]);
    expect([a, c].filter((r) => r.ok && r.duplicado)).toHaveLength(1);
    expect(await b.consulta("select id from pedidos")).toHaveLength(1);
    expect(await b.consulta("select id from itens_pedido")).toHaveLength(1);
  });

  it("recusa produto desconhecido, esgotado ou repetido, sem gravar", async () => {
    expect(
      await registrarPedido({ ...base, itens: [{ slug: "nao-existe", quantidade: 1 }] }, AGORA, sem),
    ).toEqual({ ok: false, erro: "produto_desconhecido" });
    expect(await registrarPedido({ ...base, itens: [{ slug: "gama", quantidade: 1 }] }, AGORA, sem)).toEqual({
      ok: false,
      erro: "produto_esgotado",
    });
    expect(
      await registrarPedido(
        {
          ...base,
          itens: [
            { slug: "alfa", quantidade: 1 },
            { slug: "alfa", quantidade: 1 },
          ],
        },
        AGORA,
        sem,
      ),
    ).toEqual({ ok: false, erro: "produto_repetido" });
    expect(await b.consulta("select id from pedidos")).toHaveLength(0);
  });

  it("entrega agendada: frete só com cotação do mesmo CEP; sem ela, frete e contribuição a confirmar", async () => {
    const cot = { cep: "13800010", km1Decimal: 3.4, kmCobrado: 4, valor: 4, exp: AGORA + 1000 };
    await registrarPedido(
      {
        ...base,
        id: "CK-261024-BBBBBBB",
        modalidade: "entrega",
        horario: "2026-10-25|14h",
        cidade: "mogi guacu",
        cep: "13800-010",
        cotacao: "x",
      },
      AGORA,
      () => cot,
    );
    await registrarPedido(
      {
        ...base,
        id: "CK-261024-CCCCCCC",
        modalidade: "entrega",
        cidade: "Mogi Mirim",
        cep: "13800-020",
        cotacao: "x",
      },
      AGORA,
      () => cot,
    );
    const linhas = await b.consulta<Record<string, unknown>>(
      `select id, cidade, entrega_data::text as d, entrega_faixa as f, distancia_km::float8 as km, frete::float8 as frete,
              contribuicao is null as sem_contrib from pedidos order by id`,
    );
    expect(linhas).toEqual([
      {
        id: "CK-261024-BBBBBBB",
        cidade: "Mogi Guaçu",
        d: "2026-10-25",
        f: "14h",
        km: 3.4,
        frete: 4,
        sem_contrib: false,
      },
      {
        id: "CK-261024-CCCCCCC",
        cidade: "Mogi Mirim",
        d: "2026-10-24",
        f: "agora",
        km: null,
        frete: null,
        sem_contrib: true,
      },
    ]);
  });

  it("operação: pedidos de hoje em diante com itens e total; status muda", async () => {
    await registrarPedido({ ...base, id: "CK-261024-DDDDDDD", horario: "2026-10-25|13h" }, AGORA, sem);
    await registrarPedido(base, AGORA, sem);
    await b.consulta(
      `insert into pedidos (id, criado_em, entrega_data, tipo_registro) values ('1', now(), '2026-10-01', 'historico')`,
    );
    const lista = await pedidosDaOperacao("2026-10-24");
    expect(lista.map((p) => p.id)).toEqual(["CK-261024-AAAAAAA", "CK-261024-DDDDDDD"]);
    expect(lista[0]).toMatchObject({
      entregaFaixa: "agora",
      receita: 36,
      frete: 0,
      total: 36,
      criadoEm: AGORA,
    });
    expect(lista[0].itens).toEqual([{ nome: "Alfa", quantidade: 2, preco: 18 }]);
    expect(await mudarStatus("CK-261024-AAAAAAA", "concluido")).toBe(true);
    expect((await pedidosDaOperacao("2026-10-24"))[0].status).toBe("concluido");
    expect(await mudarStatus("CK-000000-XXXXXXX", "concluido")).toBe(false);
  });
});
