import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usarBanco } from "@/server/db";
import { definirEstoque, estoqueAtual } from "@/server/estoque";
import { adicionarDespesa, quebra, resumoFinanceiro, vendasPorSabor } from "@/server/financeiro";
import { mudarStatus, registrarPedido, type EntradaPedido } from "@/server/pedidos";
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

  it("pedido reserva; sem unidades suficientes entra marcado; cancelar devolve; reativar reserva de novo", async () => {
    const p1 = pedido([{ slug: "alfa", quantidade: 2 }]);
    expect(await registrarPedido(p1, AGORA, sem)).toEqual({ ok: true, duplicado: false, semEstoque: false });
    expect(await estoque(b, "alfa")).toBe(1);

    const p2 = pedido([{ slug: "alfa", quantidade: 2 }]);
    expect(await registrarPedido(p2, AGORA, sem)).toMatchObject({ ok: true, semEstoque: true });
    expect(await estoque(b, "alfa")).toBe(0);

    // Esgotado no site:
    expect((await estoqueAtual()).find((s) => s.slug === "alfa")).toMatchObject({
      estoque: 0,
      disponivel: false,
    });

    await mudarStatus(p1.id, "cancelado");
    expect(await estoque(b, "alfa")).toBe(2);
    await mudarStatus(p1.id, "abandonado"); // continua inativo: não devolve de novo
    expect(await estoque(b, "alfa")).toBe(2);
    await mudarStatus(p1.id, "pendente");
    expect(await estoque(b, "alfa")).toBe(0);

    // Clique duplo não baixa duas vezes.
    expect(await registrarPedido(p1, AGORA, sem)).toMatchObject({ duplicado: true });
    expect(await estoque(b, "alfa")).toBe(0);
  });

  it("sabor sem controle de estoque não muda; contagem do admin vira ajuste", async () => {
    await registrarPedido(pedido([{ slug: "beta", quantidade: 5 }]), AGORA, sem);
    expect(await estoque(b, "beta")).toBeNull();
    await definirEstoque(1, 10);
    expect(await estoque(b, "alfa")).toBe(10);
    const mov = await b.consulta("select quantidade, motivo from movimentos_estoque order by id");
    expect(mov).toEqual([{ quantidade: 7, motivo: "ajuste" }]);
  });

  it("dois pedidos ao mesmo tempo pela última unidade: só um leva", async () => {
    await definirEstoque(1, 1);
    const r = await Promise.all([
      registrarPedido(pedido([{ slug: "alfa", quantidade: 1 }]), AGORA, sem),
      registrarPedido(pedido([{ slug: "alfa", quantidade: 1 }]), AGORA, sem),
    ]);
    expect(r.filter((x) => x.ok && x.semEstoque)).toHaveLength(1);
    expect(await estoque(b, "alfa")).toBe(0);
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
