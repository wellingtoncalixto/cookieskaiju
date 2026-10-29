import { describe, expect, it } from "vitest";
import { calcularReceitas, type Insumo, type Receita } from "@/lib/precificacao";

// Números fictícios (o repositório é público: as receitas reais ficam só no banco).
const insumos: Insumo[] = [
  { id: 1, nome: "Farinha", unidade: "g", embalagemQtd: 1000, embalagemPreco: 5 },
  { id: 2, nome: "Manteiga", unidade: "g", embalagemQtd: 500, embalagemPreco: 20 },
  { id: 3, nome: "Chocolate", unidade: "g", embalagemQtd: 1000, embalagemPreco: 100 },
  { id: 4, nome: "Saquinho", unidade: "un", embalagemQtd: 500, embalagemPreco: 35 },
];
const massa: Receita = {
  id: 10,
  nome: "Massa",
  tipo: "base",
  rendimento: 1000,
  unidadeRendimento: "g",
  maoDeObraPct: 0.3, // ignorada na base
  usaForno: false,
  ingredientes: [
    { insumoId: 1, subReceitaId: null, quantidade: 500 }, // 2,50
    { insumoId: 2, subReceitaId: null, quantidade: 250 }, // 10,00
  ],
};
const sabor: Receita = {
  id: 20,
  nome: "Sabor",
  tipo: "sabor",
  rendimento: 15,
  unidadeRendimento: "un",
  maoDeObraPct: 0.3,
  usaForno: true,
  ingredientes: [
    { insumoId: null, subReceitaId: 10, quantidade: 1200 }, // 1200 × 0,0125 = 15,00
    { insumoId: 3, subReceitaId: null, quantidade: 250 }, // 25,00
    { insumoId: 4, subReceitaId: null, quantidade: 15 }, // 1,05
  ],
};
const forno = { potenciaW: 1800, minutosFornada: 14, cookiesFornada: 6, precoKwh: 0.9 };

describe("precificação", () => {
  const r = calcularReceitas(insumos, [sabor, massa], forno);

  it("receita base: custo por grama, sem mão de obra", () => {
    const m = r.get(10)!;
    expect(m.total).toBeCloseTo(12.5);
    expect(m.porUnidade).toBeCloseTo(0.0125);
    expect(m.final).toBeCloseTo(0.0125);
  });

  it("sabor: sub-receita por grama + energia por fornada + mão de obra", () => {
    const s = r.get(20)!;
    expect(s.ingredientes).toBeCloseTo(41.05);
    expect(s.fornadas).toBe(3); // ⌈15 ÷ 6⌉
    expect(s.energia).toBeCloseTo(3 * 0.378); // 1800 W × 14 min = 0,42 kWh × R$ 0,90
    expect(s.total).toBeCloseTo(42.184);
    expect(s.porUnidade).toBeCloseTo(42.184 / 15);
    expect(s.final).toBeCloseTo((42.184 / 15) * 1.3);
    expect(s.avisos).toEqual([]);
  });

  it("forno sem parâmetros: avisa e não soma energia", () => {
    const s = calcularReceitas(insumos, [sabor, massa], { ...forno, precoKwh: null }).get(20)!;
    expect(s.energia).toBe(0);
    expect(s.avisos[0]).toMatch(/energia/);
  });

  it("receita que usa a si mesma não trava o cálculo", () => {
    const ciclo: Receita = { ...massa, ingredientes: [{ insumoId: null, subReceitaId: 10, quantidade: 1 }] };
    expect(calcularReceitas(insumos, [ciclo], forno).get(10)!.avisos[0]).toMatch(/a si mesma/);
  });
});
