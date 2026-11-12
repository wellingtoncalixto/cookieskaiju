import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usarBanco } from "@/server/db";
import { definirEstoque, estoqueAtual } from "@/server/estoque";
import { adicionarDespesa, quebra, resumoFinanceiro, vendasPorSabor } from "@/server/financeiro";
import { mudarStatus, registrarPedido, registrarPedidoManual, type EntradaPedido } from "@/server/pedidos";
import { bancoDeTeste } from "./apoio/banco";

// Dados fictícios (o repositório é público).
const AGORA = Date.parse("2026-10-24T15:00:00-03:00");
const sem = () => null;
let n = 0;
const pedido = (itens: EntradaPedido["itens"], extra: Partial<EntradaPedido> = {}): EntradaPedido => ({
  id: `CK-261024-${String(++n).padStart(7, "A")}`,
  modalidade: "retirada",
  horario: "agora",
  itens,
  pagamento: "pix",
  cidade: "",
  cep: "",
  ...extra,
});

async function preparar() {
  const b = await bancoDeTeste();
  await b.consulta(`insert into produtos (slug, nome, preco, custo_unitario, estoque) values
    ('alfa', 'Alfa', 18, 6, 3), ('beta', 'Beta', 20, 7, null)`);
  await b.consulta(`insert into configuracao (chave, valor) values
    ('kraft_preco', 1.5), ('kraft_cookies_por_saco', 5), ('flyer_aquecimento', 0.7), ('flyer_marca', 0.91),
    ('moto_km_por_litro', 20), ('gasolina_litro', 6.6), ('taxa_pix', 0), ('taxa_credito', 0.0315),
    ('taxa_debito', 0.0137), ('taxa_dinheiro', 0)`);
  usarBanco(b);
  return b;
}

const estoque = async (b: Awaited<ReturnType<typeof preparar>>, slug: string) =>
  (await b.consulta<{ estoque: number | null }>("select estoque from produtos where slug = $1", [slug]))[0]
    .estoque;

describe("estoque", () => {
  let b: Awaited<ReturnType<typeof preparar>>;
  beforeEach(async () => {
    b = await preparar();
  });
  afterEach(() => usarBanco(null));

  const semEstoque = async (id: string) =>
    (await b.consulta<{ sem_estoque: boolean }>("select sem_estoque from pedidos where id = $1", [id]))[0]
      .sem_estoque;

  it("pedido do site não mexe no estoque; concluir baixa; tirar de concluído devolve", async () => {
    const p1 = pedido([{ slug: "alfa", quantidade: 2 }]);
    expect(await registrarPedido(p1, AGORA, sem)).toEqual({ ok: true, duplicado: false, semEstoque: false });
    expect(await estoque(b, "alfa")).toBe(3);
    // Mais do que há: entra marcado, sem baixar.
    const p2 = pedido([{ slug: "alfa", quantidade: 4 }]);
    expect(await registrarPedido(p2, AGORA, sem)).toMatchObject({ ok: true, semEstoque: true });
    expect(await estoque(b, "alfa")).toBe(3);
    expect(await b.consulta("select id from movimentos_estoque")).toEqual([]);

    await mudarStatus(p1.id, "concluido");
    expect(await estoque(b, "alfa")).toBe(1);
    await mudarStatus(p1.id, "concluido"); // de novo: não baixa duas vezes
    expect(await estoque(b, "alfa")).toBe(1);

    // Concluir sem unidades suficientes: zera o que restava e marca.
    await mudarStatus(p2.id, "concluido");
    expect(await estoque(b, "alfa")).toBe(0);
    expect(await semEstoque(p2.id)).toBe(true);
    expect((await estoqueAtual()).find((s) => s.slug === "alfa")).toMatchObject({
      estoque: 0,
      disponivel: false,
    });
    await mudarStatus(p2.id, "pendente"); // devolve só o que baixou (1)
    expect(await estoque(b, "alfa")).toBe(1);

    await mudarStatus(p1.id, "cancelado");
    expect(await estoque(b, "alfa")).toBe(3);
    await mudarStatus(p1.id, "abandonado"); // continua fora de concluído: não devolve de novo
    expect(await estoque(b, "alfa")).toBe(3);
    await mudarStatus(p1.id, "pendente"); // reativado: pendente não reserva
    expect(await estoque(b, "alfa")).toBe(3);
    await mudarStatus(p1.id, "concluido");
    expect(await estoque(b, "alfa")).toBe(1);
    await mudarStatus(p1.id, "abandonado");
    expect(await estoque(b, "alfa")).toBe(3);

    // Pendente novo ↔ cancelado não mexe.
    const p3 = pedido([{ slug: "alfa", quantidade: 1 }]);
    await registrarPedido(p3, AGORA, sem);
    await mudarStatus(p3.id, "cancelado");
    await mudarStatus(p3.id, "pendente");
    expect(await estoque(b, "alfa")).toBe(3);

    // Clique duplo no envio não grava nem baixa de novo.
    expect(await registrarPedido(p1, AGORA, sem)).toMatchObject({ duplicado: true });
    expect(await estoque(b, "alfa")).toBe(3);
  });

  it("pendente antigo (reservou ao chegar): concluir não baixa de novo; cancelar devolve a reserva", async () => {
    // Pedidos de antes da regra: a reserva ficou nos movimentos.
    const antigo = async () => {
      const p = pedido([{ slug: "alfa", quantidade: 1 }]);
      await registrarPedido(p, AGORA, sem);
      await b.consulta("update produtos set estoque = estoque - 1 where slug = 'alfa'");
      await b.consulta(
        "insert into movimentos_estoque (produto_id, quantidade, motivo, pedido_id) values (1, -1, 'venda', $1)",
        [p.id],
      );
      return p;
    };
    const a = await antigo();
    const c = await antigo();
    expect(await estoque(b, "alfa")).toBe(1);

    await mudarStatus(a.id, "concluido");
    expect(await estoque(b, "alfa")).toBe(1);
    await mudarStatus(c.id, "cancelado");
    expect(await estoque(b, "alfa")).toBe(2);
    await mudarStatus(c.id, "concluido"); // reativado e concluído: agora baixa
    expect(await estoque(b, "alfa")).toBe(1);
    await mudarStatus(a.id, "pendente"); // sai de concluído: devolve a reserva antiga
    expect(await estoque(b, "alfa")).toBe(2);
  });

  it("sabor sem controle de estoque não muda; contagem do admin vira ajuste", async () => {
    await registrarPedido(pedido([{ slug: "beta", quantidade: 5 }]), AGORA, sem);
    expect(await estoque(b, "beta")).toBeNull();
    await definirEstoque(1, 10);
    expect(await estoque(b, "alfa")).toBe(10);
    const mov = await b.consulta("select quantidade, motivo from movimentos_estoque order by id");
    expect(mov).toEqual([{ quantidade: 7, motivo: "ajuste" }]);
  });

  it("dois pedidos concluídos ao mesmo tempo pela última unidade: só um leva; clique duplo baixa uma vez", async () => {
    await definirEstoque(1, 1);
    const [x, y] = [pedido([{ slug: "alfa", quantidade: 1 }]), pedido([{ slug: "alfa", quantidade: 1 }])];
    for (const p of [x, y]) await registrarPedido(p, AGORA, sem);
    await Promise.all([mudarStatus(x.id, "concluido"), mudarStatus(y.id, "concluido")]);
    expect([await semEstoque(x.id), await semEstoque(y.id)].filter(Boolean)).toHaveLength(1);
    expect(await estoque(b, "alfa")).toBe(0);

    await definirEstoque(1, 3);
    const z = pedido([{ slug: "alfa", quantidade: 2 }]);
    await registrarPedido(z, AGORA, sem);
    await Promise.all([mudarStatus(z.id, "concluido"), mudarStatus(z.id, "concluido")]);
    expect(await estoque(b, "alfa")).toBe(1);
  });
});

describe("financeiro", () => {
  beforeEach(async () => {
    await preparar();
  });
  afterEach(() => usarBanco(null));

  it("soma só os concluídos do período e desconta as despesas", async () => {
    const a = pedido([{ slug: "alfa", quantidade: 2 }]); // 36, custo 12
    const c = pedido([{ slug: "beta", quantidade: 1 }], { pagamento: "credito" }); // 20, custo 7
    const pend = pedido([{ slug: "beta", quantidade: 2 }]); // pendente: 40
    const fora = pedido([{ slug: "beta", quantidade: 1 }], { horario: "2026-11-07|14h" });
    for (const p of [a, c, pend, fora]) await registrarPedido(p, AGORA, sem);
    for (const p of [a, c, fora]) await mudarStatus(p.id, "concluido");
    await adicionarDespesa({ data: "2026-10-20", categoria: "Insumos", descricao: "chocolate", valor: 30 });
    await adicionarDespesa({
      data: "2026-11-01",
      categoria: "Marketing",
      descricao: "fora do período",
      valor: 99,
    });

    const r = await resumoFinanceiro("2026-10-01", "2026-10-31");
    expect(r).toMatchObject({
      pedidos: 2,
      cookies: 3,
      receitaCookies: 56,
      faturamento: 56,
      custoCookies: 19,
    });
    expect(r.pendentes).toBe(1);
    expect(r.valorPendente).toBe(40);
    expect(r.despesas).toBe(30);
    expect(r.taxas).toBeCloseTo(20 * 0.0315);
    expect(r.contribuicao).toBeCloseTo(56 - 19 - 2 * (1.5 + 1.61) - 20 * 0.0315);

    expect(await vendasPorSabor("2026-10-01", "2026-10-31")).toEqual([
      { sabor: "Alfa", cookies: 2, receita: 36, custo: 12 },
      { sabor: "Beta", cookies: 1, receita: 20, custo: 7 },
    ]);
    expect((await quebra("pagamento", "2026-10-01", "2026-10-31")).map((l) => [l.chave, l.pedidos])).toEqual([
      ["pix", 1],
      ["credito", 1],
    ]);
  });
});

describe("pedido manual (admin)", () => {
  afterEach(() => usarBanco(null));

  it("recebe o próximo número, baixa estoque se já concluído, calcula valores e entra no financeiro", async () => {
    const b = await preparar();
    await b.consulta("select setval('pedidos_numero_seq', 9, false)");
    const r = await registrarPedidoManual(
      {
        itens: [
          { produtoId: 1, quantidade: 2 },
          { produtoId: 2, quantidade: 1 },
        ],
        modalidade: "entrega",
        entregaData: "2026-10-24",
        entregaFaixa: "14h",
        pagamento: "credito",
        cidade: "Mogi Mirim",
        frete: 5,
        distanciaKm: 4,
        origem: "pessoal",
        relacaoCliente: "novo",
        comoConheceu: "Indicação",
        status: "concluido",
      },
      AGORA,
    );
    expect(r).toEqual({ ok: true, numero: 9, semEstoque: false });
    expect(await estoque(b, "alfa")).toBe(1); // 3 - 2
    const [p] = await b.consulta<Record<string, unknown>>(
      `select numero, tipo_registro, origem, status, receita_cookies::float8 as receita, frete::float8 as frete,
              combustivel::float8 as comb, contribuicao is not null as tem_contrib from pedidos`,
    );
    expect(p).toMatchObject({
      numero: 9,
      tipo_registro: "manual",
      origem: "pessoal",
      status: "concluido",
      receita: 56,
      frete: 5,
      tem_contrib: true,
    });
    expect(p.comb).toBeCloseTo((2 * 4 * 6.6) / 20);
    expect((await resumoFinanceiro("2026-10-01", "2026-10-31")).faturamento).toBe(61);
    // Sem nenhum sabor: recusa.
    const vazio = await registrarPedidoManual(
      {
        itens: [],
        modalidade: "retirada",
        entregaData: "2026-10-24",
        entregaFaixa: null,
        pagamento: "pix",
        cidade: "",
        frete: null,
        distanciaKm: null,
        origem: "pessoal",
        relacaoCliente: null,
        comoConheceu: "",
        status: "pendente",
      },
      AGORA,
    );
    expect(vazio.ok).toBe(false);
  });

  it("lançado pendente não baixa (avisa se faltam unidades); baixa ao concluir", async () => {
    const b = await preparar();
    const lancar = (quantidade: number) =>
      registrarPedidoManual(
        {
          itens: [{ produtoId: 1, quantidade }],
          modalidade: "retirada",
          entregaData: "2026-10-24",
          entregaFaixa: null,
          pagamento: "pix",
          cidade: "",
          frete: null,
          distanciaKm: null,
          origem: "pessoal",
          relacaoCliente: null,
          comoConheceu: "",
          status: "pendente",
        },
        AGORA,
      );
    expect(await lancar(2)).toMatchObject({ ok: true, semEstoque: false });
    expect(await lancar(5)).toMatchObject({ ok: true, semEstoque: true });
    expect(await estoque(b, "alfa")).toBe(3);
    const ps = await b.consulta<{ id: string; sem_estoque: boolean }>(
      "select id, sem_estoque from pedidos order by numero",
    );
    expect(ps.map((p) => p.sem_estoque)).toEqual([false, true]);
    await mudarStatus(ps[0].id, "concluido");
    expect(await estoque(b, "alfa")).toBe(1);
  });
});
