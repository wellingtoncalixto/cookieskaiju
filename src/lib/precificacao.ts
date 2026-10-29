/**
 * Precificação (substitui a "Planilha Precificação Geral").
 *
 * - Custo de um insumo = preço da embalagem ÷ tamanho da embalagem, vezes a quantidade usada.
 * - Receita base (ex.: massa): custo por unidade de rendimento (por grama), sem mão de obra.
 *   Entra em outras receitas como sub-receita, pela quantidade usada.
 * - Receita de sabor: (ingredientes + energia do forno) ÷ rendimento = custo por cookie;
 *   custo final = custo por cookie × (1 + mão de obra).
 * - Energia (forno elétrico): fornadas = ⌈rendimento ÷ cookies por fornada⌉;
 *   cada fornada gasta potência (W) × minutos ÷ 60 ÷ 1000 × preço do kWh.
 */

export type Insumo = {
  id: number;
  nome: string;
  unidade: "g" | "ml" | "un";
  embalagemQtd: number;
  embalagemPreco: number;
};

export type Ingrediente = { insumoId: number | null; subReceitaId: number | null; quantidade: number };

export type Receita = {
  id: number;
  nome: string;
  tipo: "sabor" | "base";
  rendimento: number;
  unidadeRendimento: "un" | "g";
  maoDeObraPct: number;
  usaForno: boolean;
  ingredientes: Ingrediente[];
};

export type ParametrosForno = {
  potenciaW: number | null;
  minutosFornada: number | null;
  cookiesFornada: number | null;
  precoKwh: number | null;
};

/** `indice` = posição do ingrediente em `receita.ingredientes`. */
export type LinhaCusto = { indice: number; nome: string; quantidade: number; unidade: string; custo: number };

export type CustoReceita = {
  linhas: LinhaCusto[];
  ingredientes: number;
  fornadas: number;
  energia: number;
  /** Ingredientes + energia (o lote inteiro). */
  total: number;
  /** Total ÷ rendimento, sem mão de obra. */
  porUnidade: number;
  /** Por unidade com mão de obra (sabor); igual a porUnidade na base. */
  final: number;
  avisos: string[];
};

export function energiaPorFornada(f: ParametrosForno): number | null {
  if (f.potenciaW == null || f.minutosFornada == null || f.precoKwh == null) return null;
  return ((f.potenciaW * f.minutosFornada) / 60 / 1000) * f.precoKwh;
}

export function calcularReceitas(
  insumos: Insumo[],
  receitas: Receita[],
  forno: ParametrosForno,
): Map<number, CustoReceita> {
  const porInsumo = new Map(insumos.map((i) => [i.id, i]));
  const porReceita = new Map(receitas.map((r) => [r.id, r]));
  const resultado = new Map<number, CustoReceita>();
  const emCalculo = new Set<number>();

  function calcular(r: Receita): CustoReceita {
    const pronto = resultado.get(r.id);
    if (pronto) return pronto;
    const avisos: string[] = [];
    const linhas: LinhaCusto[] = [];
    emCalculo.add(r.id);
    for (const [indice, ing] of r.ingredientes.entries()) {
      if (ing.insumoId != null) {
        const i = porInsumo.get(ing.insumoId);
        if (!i) {
          avisos.push(`insumo ${ing.insumoId} não encontrado`);
          continue;
        }
        linhas.push({
          indice,
          nome: i.nome,
          quantidade: ing.quantidade,
          unidade: i.unidade,
          custo: (ing.quantidade * i.embalagemPreco) / i.embalagemQtd,
        });
      } else if (ing.subReceitaId != null) {
        const sub = porReceita.get(ing.subReceitaId);
        if (!sub || emCalculo.has(sub.id)) {
          avisos.push(
            sub ? `receita "${sub.nome}" usa a si mesma` : `receita ${ing.subReceitaId} não encontrada`,
          );
          continue;
        }
        const c = calcular(sub);
        avisos.push(...c.avisos.map((a) => `${sub.nome}: ${a}`));
        linhas.push({
          indice,
          nome: sub.nome,
          quantidade: ing.quantidade,
          unidade: sub.unidadeRendimento,
          custo: ing.quantidade * c.porUnidade,
        });
      }
    }
    emCalculo.delete(r.id);

    const ingredientes = linhas.reduce((s, l) => s + l.custo, 0);
    let fornadas = 0;
    let energia = 0;
    if (r.usaForno) {
      const porFornada = energiaPorFornada(forno);
      if (porFornada == null || !forno.cookiesFornada || r.unidadeRendimento !== "un") {
        avisos.push("energia do forno não calculada (parâmetros do forno incompletos)");
      } else {
        fornadas = Math.ceil(r.rendimento / forno.cookiesFornada);
        energia = fornadas * porFornada;
      }
    }
    const total = ingredientes + energia;
    const porUnidade = total / r.rendimento;
    const final = r.tipo === "sabor" ? porUnidade * (1 + r.maoDeObraPct) : porUnidade;
    const c = { linhas, ingredientes, fornadas, energia, total, porUnidade, final, avisos };
    resultado.set(r.id, c);
    return c;
  }

  for (const r of receitas) calcular(r);
  return resultado;
}
