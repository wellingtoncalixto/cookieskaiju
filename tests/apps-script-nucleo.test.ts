import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";
import { hmacHex, montarEnvelope } from "@/lib/assinatura";

/**
 * Testa apps-script/Nucleo.gs (o mesmo arquivo que vai para o Apps Script) com uma planilha simulada.
 * Simula as abas como no Painel real: dados a partir da linha 4, 8 pedidos históricos,
 * fórmulas em Pedidos H–M e Itens D–G até a linha 303.
 */
type Nucleo = {
  CONFIG: { linhaInicial: number; limiteLinhas: number };
  registrar: (
    planilha: unknown,
    corpo: unknown,
    cfg?: unknown,
  ) => { ok: boolean; duplicado: boolean; linha?: number; avisos: string[] };
  validarEnvelope: (...args: unknown[]) => { ok: boolean; erro?: string; corpo?: unknown };
  localizarIncompletos: (planilha: unknown) => string[];
};
const codigo = readFileSync(join(process.cwd(), "apps-script", "Nucleo.gs"), "utf8");
const carregar = (): Nucleo => {
  const contexto: Record<string, unknown> = {};
  vm.runInNewContext(
    `${codigo}\nthis.__ = { CONFIG, registrar, validarEnvelope, localizarIncompletos };`,
    contexto,
  );
  return contexto.__ as Nucleo;
};

/** Aba simulada: células por "linha:coluna", fórmulas marcadas à parte, registro de toda escrita. */
class AbaFalsa {
  celulas = new Map<string, unknown>();
  formulas = new Set<string>();
  escritas: { linha: number; coluna: number; n: number }[] = [];
  falharNaEscrita: number | null = null;
  constructor(
    private linhaInicial: number,
    private colunaChave: number,
  ) {}
  ultimaLinha() {
    let ultima = 0;
    for (const k of [...this.celulas.keys(), ...this.formulas])
      ultima = Math.max(ultima, Number(k.split(":")[0]));
    return ultima;
  }
  valoresColuna(coluna: number) {
    const out: unknown[] = [];
    for (let l = this.linhaInicial; l <= this.ultimaLinha(); l++)
      out.push(this.celulas.get(`${l}:${coluna}`) ?? "");
    return out;
  }
  escrever(linha: number, coluna: number, valores: unknown[]) {
    if (this.falharNaEscrita !== null && this.escritas.length === this.falharNaEscrita)
      throw new Error("falha simulada");
    valores.forEach((v, i) => this.celulas.set(`${linha}:${coluna + i}`, v));
    this.escritas.push({ linha, coluna, n: valores.length });
  }
  limpar(linha: number, coluna: number, n: number) {
    for (let i = 0; i < n; i++) this.celulas.delete(`${linha}:${coluna + i}`);
  }
  temFormula(linha: number, coluna: number) {
    return this.formulas.has(`${linha}:${coluna}`);
  }
  copiarFormulas(_de: number, para: number, coluna: number, n: number) {
    for (let i = 0; i < n; i++) this.formulas.add(`${para}:${coluna + i}`);
  }
  valor(linha: number, coluna: number) {
    return this.celulas.get(`${linha}:${coluna}`);
  }
  get colunaId() {
    return this.colunaChave;
  }
}

function planilhaComHistorico() {
  const pedidos = new AbaFalsa(4, 2);
  const itens = new AbaFalsa(4, 1);
  for (let l = 4; l <= 303; l++) {
    for (let c = 8; c <= 13; c++) pedidos.formulas.add(`${l}:${c}`); // H–M
    for (let c = 4; c <= 7; c++) itens.formulas.add(`${l}:${c}`); // D–G
  }
  // 8 pedidos históricos (IDs 1 a 8) com 1 item cada.
  for (let id = 1; id <= 8; id++) {
    const l = 3 + id;
    pedidos.escrever(l, 1, [new Date(2026, 9, 10), id, "Mogi Mirim", 3, "Pix", "Concluído", 3]);
    pedidos.escrever(l, 14, ["instagram", "Entrega", "", "", "13:00", "Histórico manual"]);
    itens.escrever(l, 1, [id, "Kinder", 1]);
  }
  pedidos.escritas = [];
  itens.escritas = [];
  return { pedidos, itens };
}

const corpo = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  data: "2026-10-24",
  hora: "14:05",
  cidade: "Mogi Mirim",
  distanciaKm: 4.2,
  pagamento: "Pix",
  status: "Pendente",
  frete: 5,
  origem: "site",
  atendimento: "Entrega",
  relacao: "",
  comoConheceu: "",
  tipoRegistro: "Site automático",
  itens: [
    { produto: "Explosão de Nutella", quantidade: 2 },
    { produto: "Duplo Maltine", quantidade: 1 },
  ],
  ...extra,
});

describe("Apps Script: registro na planilha", () => {
  let n: Nucleo;
  let p: ReturnType<typeof planilhaComHistorico>;
  beforeEach(() => {
    n = carregar();
    p = planilhaComHistorico();
  });

  it("grava na primeira linha livre, só em A–G e N–S, sem tocar nas fórmulas H–M", () => {
    const r = n.registrar(p, corpo("CK-261024-AAAAAAA"));
    expect(r).toMatchObject({ ok: true, duplicado: false, linha: 12 });
    expect(p.pedidos.escritas).toEqual([
      { linha: 12, coluna: 1, n: 7 },
      { linha: 12, coluna: 14, n: 6 },
    ]);
    expect(p.pedidos.valor(12, 2)).toBe("CK-261024-AAAAAAA");
    expect(p.pedidos.valor(12, 6)).toBe("Pendente");
    expect(p.pedidos.valor(12, 18)).toBe("14:05");
    expect(p.pedidos.valor(12, 19)).toBe("Site automático");
    for (let c = 8; c <= 13; c++) expect(p.pedidos.valor(12, c)).toBeUndefined();
  });

  it("grava cada sabor em Itens (A–C), antes da linha de Pedidos", () => {
    n.registrar(p, corpo("CK-261024-AAAAAAA"));
    expect(p.itens.escritas).toEqual([
      { linha: 12, coluna: 1, n: 3 },
      { linha: 13, coluna: 1, n: 3 },
    ]);
    expect([p.itens.valor(12, 2), p.itens.valor(12, 3)]).toEqual(["Explosão de Nutella", 2]);
    expect([p.itens.valor(13, 2), p.itens.valor(13, 3)]).toEqual(["Duplo Maltine", 1]);
  });

  it("preserva os 8 pedidos históricos", () => {
    n.registrar(p, corpo("CK-261024-AAAAAAA"));
    for (let id = 1; id <= 8; id++) {
      expect(p.pedidos.valor(3 + id, 2)).toBe(id);
      expect(p.pedidos.valor(3 + id, 19)).toBe("Histórico manual");
      expect(p.itens.valor(3 + id, 1)).toBe(id);
    }
  });

  it("mesmo ID duas vezes (clique duplo, nova tentativa): grava uma vez só", () => {
    n.registrar(p, corpo("CK-261024-AAAAAAA"));
    const segunda = n.registrar(p, corpo("CK-261024-AAAAAAA"));
    expect(segunda).toMatchObject({ ok: true, duplicado: true });
    expect(p.pedidos.valoresColuna(2).filter((v) => v === "CK-261024-AAAAAAA")).toHaveLength(1);
    expect(p.itens.valoresColuna(1).filter((v) => v === "CK-261024-AAAAAAA")).toHaveLength(2);
  });

  it("dois pedidos seguidos (a trava do Apps Script põe em fila): linhas diferentes, nada sobrescrito", () => {
    const a = n.registrar(p, corpo("CK-261024-AAAAAAA"));
    const b = n.registrar(p, corpo("CK-261024-BBBBBBB", { itens: [{ produto: "Kinder", quantidade: 3 }] }));
    expect([a.linha, b.linha]).toEqual([12, 13]);
    expect(p.itens.valor(14, 1)).toBe("CK-261024-BBBBBBB");
  });

  it("falha no meio: desfaz o que escreveu e não deixa registro pela metade", () => {
    p.pedidos.falharNaEscrita = 0; // falha ao escrever a linha de Pedidos, depois dos Itens
    expect(() => n.registrar(p, corpo("CK-261024-AAAAAAA"))).toThrow("falha simulada");
    expect(p.itens.valoresColuna(1).includes("CK-261024-AAAAAAA")).toBe(false);
    expect(p.pedidos.valoresColuna(2).includes("CK-261024-AAAAAAA")).toBe(false);
  });

  it("itens órfãos de uma tentativa interrompida são identificados e regravados sem duplicar", () => {
    // Simula uma tentativa que gravou só um item e caiu antes da linha de Pedidos.
    p.itens.escrever(12, 1, ["CK-261024-AAAAAAA", "Explosão de Nutella", 2]);
    expect(n.localizarIncompletos(p)).toEqual(["CK-261024-AAAAAAA"]);
    const r = n.registrar(p, corpo("CK-261024-AAAAAAA"));
    expect(r.avisos).toContain("itens_incompletos_recuperados:1");
    expect(p.itens.valoresColuna(1).filter((v) => v === "CK-261024-AAAAAAA")).toHaveLength(2);
    expect(n.localizarIncompletos(p)).toEqual([]);
  });

  it("retirada: distância e frete zero (combustível zero nas fórmulas)", () => {
    n.registrar(
      p,
      corpo("CK-261024-AAAAAAA", { atendimento: "Retirada", cidade: "", distanciaKm: 0, frete: 0 }),
    );
    expect([p.pedidos.valor(12, 4), p.pedidos.valor(12, 7), p.pedidos.valor(12, 15)]).toEqual([
      0,
      0,
      "Retirada",
    ]);
  });

  it("depois da linha 303: copia as fórmulas da linha de cima e avisa para ampliar o Painel", () => {
    for (let l = 12; l <= 303; l++) p.pedidos.escrever(l, 2, [`X${l}`]);
    const r = n.registrar(p, corpo("CK-261024-AAAAAAA", { itens: [{ produto: "Kinder", quantidade: 1 }] }));
    expect(r.linha).toBe(304);
    expect(p.pedidos.temFormula(304, 8)).toBe(true);
    expect(r.avisos).toContain("pedido_alem_do_limite:304");
  });
});

describe("Apps Script: autenticação do envelope", () => {
  const segredo = "segredo-de-teste-ficticio";
  const usados = new Set<string>();
  const nonceJaUsado = (x: string) => (usados.has(x) ? true : (usados.add(x), false));
  const n = carregar();

  it("aceita envelope assinado pelo site (mesmo algoritmo dos dois lados)", () => {
    const env = montarEnvelope(corpo("CK-261024-AAAAAAA"), segredo);
    const r = n.validarEnvelope(env, segredo, Date.now(), hmacHex, nonceJaUsado);
    expect(r.ok).toBe(true);
  });

  it("recusa assinatura errada, corpo alterado, envelope vencido e reenvio do mesmo nonce", () => {
    const agora = Date.now();
    const env = montarEnvelope(corpo("CK-261024-BBBBBBB"), segredo, agora);
    expect(
      n.validarEnvelope({ ...env, assinatura: "0".repeat(64) }, segredo, agora, hmacHex, nonceJaUsado).erro,
    ).toBe("assinatura_invalida");
    expect(
      n.validarEnvelope(
        { ...env, corpo: env.corpo.replace("Pix", "Gratis") },
        segredo,
        agora,
        hmacHex,
        nonceJaUsado,
      ).erro,
    ).toBe("assinatura_invalida");
    expect(n.validarEnvelope(env, "outro-segredo", agora, hmacHex, nonceJaUsado).erro).toBe(
      "assinatura_invalida",
    );
    expect(n.validarEnvelope(env, segredo, agora + 6 * 60_000, hmacHex, nonceJaUsado).erro).toBe(
      "assinatura_vencida",
    );
    expect(n.validarEnvelope(env, segredo, agora, hmacHex, nonceJaUsado).ok).toBe(true);
    expect(n.validarEnvelope(env, segredo, agora, hmacHex, nonceJaUsado).erro).toBe("reenvio_bloqueado");
  });

  it("recusa corpo com ID fora do padrão (não reutiliza IDs históricos)", () => {
    const env = montarEnvelope(corpo("7"), segredo);
    expect(n.validarEnvelope(env, segredo, Date.now(), hmacHex, nonceJaUsado).erro).toBe("id_invalido");
  });
});
