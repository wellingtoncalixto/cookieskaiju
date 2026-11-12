import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loja } from "@/config/loja";
import {
  faixaDeId,
  faixasDoDia,
  horarioPadrao,
  lerHorarioSemana,
  textoDias,
  textoDiasCurto,
  textoFuncionamento,
  textoHorasCurto,
  validarHorario,
  type HorarioSemana,
} from "@/lib/horario";
import { jsonLdPadaria } from "@/lib/seo";
import { usarBanco } from "@/server/db";
import { lerHorario } from "@/server/horario";
import { lerModoLoja } from "@/server/modo-loja";
import { bancoDeTeste } from "./apoio/banco";

// As ações do admin: a sessão e o cache do Next são substituídos aqui (fora do servidor do Next).
const sessao = vi.hoisted(() => ({ valida: true }));
const cache = vi.hoisted(() => ({ tags: [] as string[], caminhos: [] as string[] }));
vi.mock("@/server/sessao-admin", () => ({
  exigirAdmin: async () => {
    if (!sessao.valida) throw new Error("NEXT_REDIRECT /admin/login");
  },
  adminConfigurado: () => true,
  criarSessao: async () => {},
  encerrarSessao: async () => {},
  loginBloqueado: () => false,
  registrarErroLogin: () => {},
  senhaConfere: () => false,
}));
vi.mock("next/cache", () => ({
  revalidateTag: (tag: string) => cache.tags.push(tag),
  revalidatePath: (caminho: string) => cache.caminhos.push(caminho),
  unstable_cache: <T>(f: T) => f,
}));

const { definirAbertaAgoraAcao, definirAutomaticoAcao, salvarHorarioAcao } =
  await import("../app/admin/acoes");

const semana = (mudar: (h: HorarioSemana) => void) => {
  const h = horarioPadrao();
  mudar(h);
  return h;
};

describe("textos do horário", () => {
  it("padrão: sábado e domingo, das 13h às 18h", () => {
    const h = horarioPadrao();
    expect(textoFuncionamento(h)).toBe("sábado e domingo, das 13h às 18h");
    expect(textoFuncionamento(h, true)).toBe("aos sábados e domingos, das 13h às 18h");
    expect(textoDiasCurto(h)).toBe("Sáb e dom");
    expect(textoHorasCurto(h)).toBe("13h às 18h");
  });

  it("dias com horários diferentes", () => {
    const h = semana((h) => {
      for (const d of [1, 2, 3, 4, 5]) h[d] = { aberto: true, abre: 600, fecha: 1080 };
      h[0].aberto = false;
      h[6] = { aberto: true, abre: 810, fecha: 1080 };
    });
    expect(textoFuncionamento(h)).toBe("de segunda a sexta, das 10h às 18h, e sábado, das 13h30 às 18h");
    expect(textoFuncionamento(h, true)).toBe(
      "de segunda a sexta, das 10h às 18h, e aos sábados, das 13h30 às 18h",
    );
    expect(textoDiasCurto(h)).toBe("Seg a sáb");
    expect(textoHorasCurto(h)).toBe("Varia por dia");
    expect(textoDias([1, 3, 5], true)).toBe("às segundas, quartas e sextas");
    expect(textoDias([5, 6], true)).toBe("às sextas e aos sábados");
  });

  it("nenhum dia aberto: texto vazio", () => {
    const h = semana((h) => h.forEach((d) => (d.aberto = false)));
    expect(textoFuncionamento(h)).toBe("");
    expect(textoDiasCurto(h)).toBe("");
  });

  it("faixas de 1 hora e leitura do id", () => {
    expect(faixasDoDia({ aberto: true, abre: 600, fecha: 750 }).map((j) => j.nome)).toEqual([
      "10h às 11h",
      "11h às 12h",
    ]);
    expect(faixasDoDia({ aberto: false, abre: 600, fecha: 900 })).toEqual([]);
    expect(faixaDeId("13h30")).toEqual({ id: "13h30", inicio: 810, fim: 870, nome: "13h30 às 14h30" });
    expect(faixaDeId("17h")?.nome).toBe("17h às 18h");
    expect(faixaDeId("agora")).toBeNull();
    expect(faixaDeId("25h")).toBeNull();
  });
});

describe("validação do horário", () => {
  it("aceita o padrão e guarda as horas dos dias fechados", () => {
    expect(validarHorario(horarioPadrao())).toEqual({ ok: true, horario: horarioPadrao() });
    const h = semana((h) => (h[2] = { aberto: false, abre: 600, fecha: 630 }));
    expect(validarHorario(h)).toMatchObject({ ok: true, horario: h });
  });

  it("fechamento antes de abertura + 1h, fora da lista ou depois da meia-noite: erro no campo do dia", () => {
    const h = semana((h) => {
      h[6] = { aberto: true, abre: 900, fecha: 930 };
      h[0] = { aberto: true, abre: 600, fecha: 1440 };
      h[1] = { aberto: true, abre: 615, fecha: 900 };
    });
    const r = validarHorario(h);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros).toEqual([
      { dia: 0, campo: "fecha", mensagem: expect.stringMatching(/^Domingo: .*meia-noite/) },
      { dia: 1, campo: "abre", mensagem: expect.stringMatching(/^Segunda: escolha a hora de abrir/) },
      {
        dia: 6,
        campo: "fecha",
        mensagem: "Sábado: o fechamento precisa ser pelo menos 1 hora depois da abertura.",
      },
    ]);
  });

  it("recusa formato errado", () => {
    expect(validarHorario(null).ok).toBe(false);
    expect(validarHorario(horarioPadrao().slice(0, 6)).ok).toBe(false);
    expect(validarHorario(semana((h) => ((h[3] as { aberto: unknown }).aberto = "sim"))).ok).toBe(false);
    expect(lerHorarioSemana([...horarioPadrao(), horarioPadrao()[0]])).toBeNull();
    expect(lerHorarioSemana(semana((h) => (h[6].fecha = 800)))).toBeNull();
    expect(lerHorarioSemana(horarioPadrao())).toEqual(horarioPadrao());
  });
});

describe("JSON-LD com o horário salvo", () => {
  it("padrão: um item com sábado e domingo, 13:00 às 18:00", () => {
    const ld = jsonLdPadaria(loja.produtos, horarioPadrao());
    expect(ld.openingHoursSpecification).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["https://schema.org/Saturday", "https://schema.org/Sunday"],
        opens: "13:00",
        closes: "18:00",
      },
    ]);
    expect(ld.description).toContain("com entrega aos sábados e domingos em Mogi Mirim");
  });

  it("horários diferentes: um item por horário; nenhum dia aberto: sem horário", () => {
    const h = semana((h) => (h[5] = { aberto: true, abre: 1080, fecha: 1320 }));
    expect(jsonLdPadaria(loja.produtos, h).openingHoursSpecification).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["https://schema.org/Friday"],
        opens: "18:00",
        closes: "22:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["https://schema.org/Saturday", "https://schema.org/Sunday"],
        opens: "13:00",
        closes: "18:00",
      },
    ]);
    const fechado = jsonLdPadaria(
      loja.produtos,
      semana((h) => h.forEach((d) => (d.aberto = false))),
    );
    expect("openingHoursSpecification" in fechado).toBe(false);
  });
});

describe("ações do admin (validadas no servidor)", () => {
  beforeEach(async () => {
    sessao.valida = true;
    cache.tags = [];
    cache.caminhos = [];
    usarBanco(await bancoDeTeste());
  });
  afterEach(() => usarBanco(null));

  it("sem sessão: não salva nada", async () => {
    sessao.valida = false;
    await expect(salvarHorarioAcao(semana((h) => (h[5].aberto = true)))).rejects.toThrow(/NEXT_REDIRECT/);
    await expect(definirAutomaticoAcao(false)).rejects.toThrow(/NEXT_REDIRECT/);
    await expect(definirAbertaAgoraAcao(true)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(await lerHorario()).toEqual(horarioPadrao());
    expect(await lerModoLoja()).toBe("automatico");
  });

  it("salva o horário válido e revalida o cache do site", async () => {
    const h = semana((h) => (h[5] = { aberto: true, abre: 1080, fecha: 1320 }));
    expect(await salvarHorarioAcao(h)).toMatchObject({ ok: true });
    expect(await lerHorario()).toEqual(h);
    expect(cache.tags).toContain("horario");
  });

  it("horário inválido (ou forjado) não salva nada e devolve os erros", async () => {
    const r = await salvarHorarioAcao(semana((h) => (h[6] = { aberto: true, abre: 900, fecha: 900 })));
    expect(r).toMatchObject({ ok: false, erros: [{ dia: 6, campo: "fecha" }] });
    expect((await salvarHorarioAcao("tudo aberto")).ok).toBe(false);
    expect((await salvarHorarioAcao([{ aberto: true, abre: -60, fecha: 99999 }])).ok).toBe(false);
    expect(await lerHorario()).toEqual(horarioPadrao());
    expect(cache.tags).toEqual([]);
  });

  it("switches: só aceitam verdadeiro/falso; manual começa no estado de agora", async () => {
    expect((await definirAutomaticoAcao("nao" as never)).ok).toBe(false);
    expect((await definirAbertaAgoraAcao(1 as never)).ok).toBe(false);
    expect(await lerModoLoja()).toBe("automatico");

    expect((await definirAbertaAgoraAcao(true)).ok).toBe(true);
    expect(await lerModoLoja()).toBe("aberto");
    expect((await definirAbertaAgoraAcao(false)).ok).toBe(true);
    expect(await lerModoLoja()).toBe("fechado");
    expect((await definirAutomaticoAcao(true)).ok).toBe(true);
    expect(await lerModoLoja()).toBe("automatico");

    // Todas as mensagens avisam do atraso do site.
    for (const r of [
      await definirAbertaAgoraAcao(true),
      await definirAbertaAgoraAcao(false),
      await definirAutomaticoAcao(false),
      await definirAutomaticoAcao(true),
    ])
      expect(r).toMatchObject({
        ok: true,
        mensagem: expect.stringMatching(/O site atualiza em até 1 minuto\.$/),
      });

    // Nenhum dia aberto: ao desligar o automático, o manual começa fechado.
    await salvarHorarioAcao(semana((h) => h.forEach((d) => (d.aberto = false))));
    expect((await definirAutomaticoAcao(false)).ok).toBe(true);
    expect(await lerModoLoja()).toBe("fechado");
  });
});
