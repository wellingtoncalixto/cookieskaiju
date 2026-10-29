import { describe, expect, it } from "vitest";
import { calcularValoresPedido, type ConfigCustos } from "@/lib/valores-pedido";

const cfg: ConfigCustos = {
  kraft_preco: 1.5,
  kraft_cookies_por_saco: 5,
  flyer_aquecimento: 0.7,
  flyer_marca: 0.91,
  moto_km_por_litro: 20,
  gasolina_litro: 6.6,
  taxa_pix: 0,
  taxa_debito: 0.0137,
  taxa_credito: 0.0315,
  taxa_dinheiro: 0,
};

describe("valores do pedido (antiga aba Pedidos, H–M)", () => {
  it("entrega no crédito: mesmas contas da antiga planilha", () => {
    // 2 × 18 + 1 × 19, 11 km, frete R$ 10, crédito (custos fictícios).
    const v = calcularValoresPedido(
      {
        itens: [
          { quantidade: 2, preco: 18, custo: 6 },
          { quantidade: 1, preco: 19, custo: 5 },
        ],
        modalidade: "entrega",
        pagamento: "credito",
        frete: 10,
        distanciaKm: 11,
      },
      cfg,
    );
    expect(v.quantidade).toBe(3);
    expect(v.receita).toBe(55);
    expect(v.custo).toBe(17);
    expect(v.embalagem).toBeCloseTo(3.11);
    expect(v.taxa).toBeCloseTo(2.0475);
    expect(v.combustivel).toBeCloseTo(7.26);
    expect(v.contribuicao).toBeCloseTo(55 + 10 - 17 - 3.11 - 2.0475 - 7.26);
  });

  it("um saco kraft a cada 5 cookies", () => {
    const v = calcularValoresPedido(
      {
        itens: [{ quantidade: 7, preco: 18, custo: 1 }],
        modalidade: "retirada",
        pagamento: "pix",
        frete: 0,
        distanciaKm: null,
      },
      cfg,
    );
    expect(v.embalagem).toBeCloseTo(2 * 1.5 + 1.61);
    expect(v.combustivel).toBe(0);
    expect(v.taxa).toBe(0);
  });

  it("frete a confirmar ou custo desconhecido: contribuição nula (não zero)", () => {
    const base = {
      itens: [{ quantidade: 1, preco: 18, custo: 6 }],
      modalidade: "entrega" as const,
      pagamento: "pix" as const,
    };
    expect(calcularValoresPedido({ ...base, frete: null, distanciaKm: null }, cfg).contribuicao).toBeNull();
    const semCusto = calcularValoresPedido(
      { ...base, itens: [{ quantidade: 1, preco: 18, custo: null }], frete: 5, distanciaKm: 4 },
      cfg,
    );
    expect(semCusto.custo).toBeNull();
    expect(semCusto.contribuicao).toBeNull();
  });

  it("parâmetro não informado: o valor fica nulo", () => {
    const v = calcularValoresPedido(
      {
        itens: [{ quantidade: 1, preco: 18, custo: 6 }],
        modalidade: "entrega",
        pagamento: "debito",
        frete: 5,
        distanciaKm: 4,
      },
      { ...cfg, taxa_debito: null, gasolina_litro: null },
    );
    expect(v.taxa).toBeNull();
    expect(v.combustivel).toBeNull();
  });
});
