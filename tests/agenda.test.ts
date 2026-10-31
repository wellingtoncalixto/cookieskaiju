import { describe, expect, it } from "vitest";
import { CHAVE_AGORA, calcularAgenda, horarioValido, textoHorario, textosAgenda } from "@/lib/agenda";

// Semana de referência: seg 12/10/2026 … dom 18/10/2026 (horário de São Paulo, UTC-3).
const sp = (diaHora: string) => new Date(`2026-10-${diaHora}:00-03:00`);
const dias = (ag: ReturnType<typeof calcularAgenda>) => ag.dias.map((d) => d.data);
const TODAS = ["13h", "14h", "15h", "16h", "17h"];

describe("calcularAgenda (sábado e domingo, 13h às 18h; hoje em 60 a 90 min)", () => {
  it("segunda 10h: fechado, sem pedido para hoje; agenda os dois próximos fins de semana", () => {
    const ag = calcularAgenda(sp("12T10:00"));
    expect(ag.modo).toBe("fechada");
    expect(ag.agora).toBe(false);
    expect(ag.previsao).toBeNull();
    expect(dias(ag)).toEqual(["2026-10-17", "2026-10-18", "2026-10-24", "2026-10-25"]);
    expect(ag.dias.every((d) => d.janelas.map((j) => j.id).join() === TODAS.join())).toBe(true);
    expect(textosAgenda(ag, sp("12T10:00").getTime()).texto).toBe(
      "Abrimos sábado, 17/10, às 13h. Você já pode fazer o pedido e agendar o horário.",
    );
  });

  it("sábado 10h: antes de abrir, o pedido para hoje conta a partir das 13h (14h a 14h30)", () => {
    const ag = calcularAgenda(sp("17T10:00"));
    expect(ag.modo).toBe("fechada");
    expect(ag.agora).toBe(true);
    expect(ag.antesDeAbrir).toBe(true);
    expect(ag.previsao).toEqual({ de: sp("17T14:00").getTime(), ate: sp("17T14:30").getTime() });
    expect(textosAgenda(ag, sp("17T10:00").getTime())).toMatchObject({
      selo: "Fechado agora",
      contagem: "Abre em 3h 00min.",
      texto: "Abrimos hoje às 13h. Peça agora e receba entre 14h e 14h30.",
    });
    expect(textoHorario(ag, CHAVE_AGORA)).toBe(
      "Hoje, 17/10 · entre 14h e 14h30 (60 a 90 min após a abertura)",
    );
    // Hoje não entra no agendamento: os dias começam amanhã.
    expect(dias(ag)).toEqual(["2026-10-18", "2026-10-24", "2026-10-25", "2026-10-31"]);
  });

  it("sábado 14h10: aberto, entrega entre 15h10 e 15h40", () => {
    const ag = calcularAgenda(sp("17T14:10"));
    expect(ag.modo).toBe("aberta");
    expect(ag.agora).toBe(true);
    expect(ag.antesDeAbrir).toBe(false);
    expect(ag.previsao).toEqual({ de: sp("17T15:10").getTime(), ate: sp("17T15:40").getTime() });
    expect(textosAgenda(ag, sp("17T14:10").getTime())).toMatchObject({
      selo: "Aberto agora",
      contagem: "Fecha em 3h 50min.",
      texto: "Delivery em 60 a 90 minutos. Peça agora ou agende para outro dia.",
    });
    expect(textoHorario(ag, CHAVE_AGORA)).toBe(
      "Hoje, 17/10 · entre 15h10 e 15h40 (60 a 90 min após o pedido)",
    );
  });

  it("sábado 17h: último horário para pedir para hoje (entrega 18h a 18h30)", () => {
    const ag = calcularAgenda(sp("17T17:00"));
    expect(ag.agora).toBe(true);
    expect(ag.previsao).toEqual({ de: sp("17T18:00").getTime(), ate: sp("17T18:30").getTime() });
  });

  it("sábado 17h01: ainda aberto, mas pedido para hoje encerrado", () => {
    const ag = calcularAgenda(sp("17T17:01"));
    expect(ag.modo).toBe("aberta");
    expect(ag.agora).toBe(false);
    expect(textosAgenda(ag, sp("17T17:01").getTime()).texto).toBe(
      "Pedidos para hoje vão até as 17h. Agende o seu para o próximo dia.",
    );
  });

  it("sábado 18h: fechado, abre domingo às 13h", () => {
    const ag = calcularAgenda(sp("17T18:00"));
    expect(ag.modo).toBe("fechada");
    expect(ag.agora).toBe(false);
    expect(ag.abreEm).toBe(sp("18T13:00").getTime());
  });

  it("domingo 19h: fechado até o sábado seguinte", () => {
    const ag = calcularAgenda(sp("18T19:00"));
    expect(ag.abreEm).toBe(new Date("2026-10-24T13:00:00-03:00").getTime());
    expect(dias(ag)).toEqual(["2026-10-24", "2026-10-25", "2026-10-31", "2026-11-01"]);
  });

  it("nunca fica sem opção para agendar", () => {
    for (const quando of ["12T00:00", "14T12:00", "16T23:59", "17T12:59", "18T17:59", "18T23:59"]) {
      expect(calcularAgenda(sp(quando)).dias.length).toBe(4);
    }
  });

  it("modo teste: sempre aberto, com pedido para hoje", () => {
    const ag = calcularAgenda(sp("14T03:00"), { modoTeste: true });
    expect(ag.modo).toBe("aberta");
    expect(ag.agora).toBe(true);
    expect(textosAgenda(ag, sp("14T03:00").getTime()).selo).toBe("Modo teste");
  });

  it("não depende do fuso do aparelho", () => {
    // Sábado 14h10 em SP = 17h10 UTC.
    const ag = calcularAgenda(new Date("2026-10-17T17:10:00Z"));
    expect(ag.previsao?.de).toBe(sp("17T15:10").getTime());
  });
});

describe("escolha de horário", () => {
  it("pedido para hoje só vale em dia de funcionamento, até as 17h", () => {
    expect(horarioValido(calcularAgenda(sp("17T14:00")), CHAVE_AGORA)).toBe(true);
    expect(horarioValido(calcularAgenda(sp("17T17:30")), CHAVE_AGORA)).toBe(false);
    expect(horarioValido(calcularAgenda(sp("12T14:00")), CHAVE_AGORA)).toBe(false);
  });

  it("faixas de hoje não valem (hoje é sem escolher horário); as dos próximos dias sim", () => {
    const ag = calcularAgenda(sp("17T14:00"));
    expect(horarioValido(ag, "2026-10-17|16h")).toBe(false);
    expect(horarioValido(ag, "2026-10-18|14h")).toBe(true);
    expect(textoHorario(ag, "2026-10-18|14h")).toBe("Domingo, 18/10 · 14h às 15h");
  });
});

describe("chave do admin (abrir/fechar)", () => {
  it("fechado à mão no horário de funcionamento: avisa, some o 'para hoje' e mantém o agendamento", () => {
    const ag = calcularAgenda(sp("17T15:00"), { modoLoja: "fechado" });
    expect(ag.modo).toBe("fechada");
    expect(ag.manual).toBe("fechado");
    expect(ag.agora).toBe(false);
    expect(ag.previsao).toBeNull();
    expect(ag.abreEm).toBeNull();
    expect(dias(ag)).toEqual(["2026-10-18", "2026-10-24", "2026-10-25", "2026-10-31"]);
    expect(horarioValido(ag, CHAVE_AGORA)).toBe(false);
    expect(textosAgenda(ag, sp("17T15:00").getTime())).toEqual({
      selo: "Fechado agora",
      contagem: "",
      texto:
        "No momento não estamos recebendo pedidos para hoje. Você pode fazer o pedido e agendar para outro dia.",
    });
  });

  it("abre mais tarde: fechado agora, sem 'para hoje', mas agenda as faixas que restam hoje", () => {
    const ag = calcularAgenda(sp("17T12:30"), { modoLoja: "mais_tarde" });
    expect(ag.modo).toBe("fechada");
    expect(ag.agora).toBe(false);
    expect(dias(ag)).toEqual(["2026-10-17", "2026-10-18", "2026-10-24", "2026-10-25", "2026-10-31"]);
    // 12h30 + 60 min: a faixa das 13h já não dá tempo.
    expect(ag.dias[0].janelas.map((j) => j.id)).toEqual(["14h", "15h", "16h", "17h"]);
    expect(horarioValido(ag, "2026-10-17|14h")).toBe(true);
    expect(horarioValido(ag, "2026-10-17|13h")).toBe(false);
    expect(horarioValido(ag, CHAVE_AGORA)).toBe(false);
    expect(textosAgenda(ag, sp("17T12:30").getTime()).texto).toMatch(/^Abrimos mais tarde hoje/);
  });

  it("abre mais tarde às 15h: antes, agenda hoje a partir das 15h; na hora, abre sozinho", () => {
    const antes = calcularAgenda(sp("17T12:00"), { modoLoja: "mais_tarde", abreAs: 15 * 60 });
    expect(antes.modo).toBe("fechada");
    expect(antes.agora).toBe(false);
    expect(antes.dias[0].janelas.map((j) => j.id)).toEqual(["15h", "16h", "17h"]);
    expect(antes.abreEm).toBe(sp("17T15:00").getTime());
    expect(textosAgenda(antes, sp("17T12:00").getTime())).toMatchObject({
      contagem: "Abre em 3h 00min.",
      texto: "Abrimos hoje às 15h. Você já pode fazer o pedido e agendar um horário para hoje ou outro dia.",
    });

    const depois = calcularAgenda(sp("17T15:00"), { modoLoja: "mais_tarde", abreAs: 15 * 60 });
    expect(depois.modo).toBe("aberta");
    expect(depois.agora).toBe(true);
    expect(dias(depois)[0]).toBe("2026-10-18");

    const noite = calcularAgenda(sp("17T19:00"), { modoLoja: "mais_tarde", abreAs: 15 * 60 });
    expect(noite.modo).toBe("fechada");
    expect(noite.agora).toBe(false);
  });

  it("abre mais tarde depois da última faixa: igual a fechado", () => {
    const ag = calcularAgenda(sp("17T16:30"), { modoLoja: "mais_tarde" });
    expect(dias(ag)).toEqual(["2026-10-18", "2026-10-24", "2026-10-25", "2026-10-31"]);
    expect(textosAgenda(ag, sp("17T16:30").getTime()).texto).toMatch(/^No momento não estamos/);
  });

  it("aberto à mão fora do calendário: libera o pedido para hoje a partir de agora", () => {
    const ag = calcularAgenda(sp("16T19:00"), { modoLoja: "aberto" });
    expect(ag.modo).toBe("aberta");
    expect(ag.agora).toBe(true);
    expect(ag.previsao).toEqual({ de: sp("16T20:00").getTime(), ate: sp("16T20:30").getTime() });
    expect(textosAgenda(ag, sp("16T19:00").getTime())).toMatchObject({ selo: "Aberto agora", contagem: "" });
  });

  it("automático: igual ao calendário", () => {
    expect(calcularAgenda(sp("17T15:00"), { modoLoja: "automatico" })).toEqual(
      calcularAgenda(sp("17T15:00")),
    );
  });
});
