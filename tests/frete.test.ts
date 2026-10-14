import { describe, expect, it } from "vitest";
import {
  arredondarKm,
  avaliarPromo,
  calcularFrete,
  dentroDaArea,
  dicaPromo,
  distanciaRetaKm,
  resolverTaxa,
  ruaGenerica,
} from "@/lib/frete";

describe("frete", () => {
  it.each([
    [2.5, 3],
    [3.0, 3],
    [3.1, 4],
    [4.2, 5],
    [7.8, 8],
    [11, 11],
  ])("%s km custa R$ %s,00", (km, valor) => {
    expect(calcularFrete(km).valor).toBe(valor);
  });

  it("arredonda para 1 casa antes de arredondar para cima", () => {
    expect(arredondarKm(4.2)).toEqual({ km1Decimal: 4.2, kmCobrado: 5 });
    expect(arredondarKm(3.04)).toEqual({ km1Decimal: 3, kmCobrado: 3 });
    expect(arredondarKm(3.05)).toEqual({ km1Decimal: 3.1, kmCobrado: 4 });
    expect(calcularFrete(5).valor).toBe(5);
    expect(calcularFrete(8).valor).toBe(8);
    expect(calcularFrete(12).valor).toBe(12);
  });
});

describe("promo", () => {
  const data = "2026-10-17";

  it("Mogi Mirim: 2 cookies não têm (falta 1); 3 têm", () => {
    const dois = avaliarPromo({ cidade: "Mogi Mirim", quantidade: 2, dataEntrega: data });
    expect(dois).toMatchObject({ gratis: false, falta: 1 });
    expect(dicaPromo(dois, 2)).toBe("Adicione mais 1 cookie e a entrega em Mogi Mirim fica grátis.");
    expect(avaliarPromo({ cidade: "Mogi Mirim", quantidade: 3, dataEntrega: data })).toMatchObject({
      gratis: true,
    });
  });

  it("Mogi Guaçu: 3 cookies não têm (falta 1); 4 têm", () => {
    expect(avaliarPromo({ cidade: "Mogi Guaçu", quantidade: 3, dataEntrega: data })).toMatchObject({
      gratis: false,
      falta: 1,
    });
    expect(avaliarPromo({ cidade: "Mogi Guaçu", quantidade: 4, dataEntrega: data })).toMatchObject({
      gratis: true,
    });
  });

  it("vale até 31/10/2026 inclusive; entrega em 01/11/2026 não tem promoção", () => {
    expect(avaliarPromo({ cidade: "Mogi Mirim", quantidade: 5, dataEntrega: "2026-10-31" })?.gratis).toBe(
      true,
    );
    expect(avaliarPromo({ cidade: "Mogi Mirim", quantidade: 5, dataEntrega: "2026-11-01" })).toBeNull();
  });

  it('"mogi guacu" (sem acento) é reconhecido', () => {
    expect(avaliarPromo({ cidade: "  mogi guacu ", quantidade: 4, dataEntrega: data })).toMatchObject({
      cidade: "Mogi Guaçu",
      gratis: true,
    });
  });

  it("outras cidades não participam", () => {
    expect(avaliarPromo({ cidade: "Itapira", quantidade: 10, dataEntrega: data })).toBeNull();
  });

  it("promoção ganha da taxa calculada", () => {
    const promo = avaliarPromo({ cidade: "Mogi Mirim", quantidade: 3, dataEntrega: data });
    const taxa = resolverTaxa(
      { status: "ok", km1Decimal: 4.2, kmCobrado: 5, valor: 5, aproximado: false },
      promo,
    );
    expect(taxa).toMatchObject({ tipo: "gratis", valor: 0 });
  });
});

describe("conferência de área", () => {
  const loja = { lat: -22.450558, lon: -46.935937 };

  it("aceita pontos em Mogi Mirim e Mogi Guaçu", () => {
    expect(dentroDaArea({ lat: -22.4137, lon: -46.95683 }, loja)).toBe(true); // Cachoeira de Cima
    expect(dentroDaArea({ lat: -22.3687, lon: -46.9425 }, loja)).toBe(true); // Centro de Mogi Guaçu
  });

  it("descarta coordenadas absurdas da base de CEPs", () => {
    expect(distanciaRetaKm({ lat: -24.02565, lon: -46.49896 }, loja)).toBeGreaterThan(150);
    expect(dentroDaArea({ lat: -24.02565, lon: -46.49896 }, loja)).toBe(false);
    expect(dentroDaArea({ lat: Number.NaN, lon: -46.9 }, loja)).toBe(false);
  });
});

describe("ruas com nome genérico", () => {
  it.each(["Rua 7", "Rua Dois", "rua três", "Rua A", "Av. 15", "Travessa 2B"])("%s é genérica", (r) => {
    expect(ruaGenerica(r)).toBe(true);
  });
  it.each(["Rua Padre Roque", "Rua Peru", "Avenida Brasil", "Rua 13 de Maio"])("%s não é genérica", (r) => {
    expect(ruaGenerica(r)).toBe(false);
  });
});
