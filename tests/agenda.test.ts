import { describe, expect, it } from "vitest";
import { CHAVE_AGORA, calcularAgenda, horarioValido, textoHorario, textosAgenda } from "@/lib/agenda";

// Semana de referência: seg 12/10/2026 … dom 18/10/2026 (horário de São Paulo, UTC-3).
const sp = (diaHora: string) => new Date(`2026-10-${diaHora}:00-03:00`);
const faixas = (ag: ReturnType<typeof calcularAgenda>) =>
  ag.dias.map((d) => [d.data, d.janelas.map((j) => j.id)]);
const TODAS = ["13h", "14h", "15h", "16h", "17h"];

describe("calcularAgenda (sábado e domingo, 13h às 18h)", () => {
  it("segunda 10h: fechado, mas dá para agendar os dois próximos fins de semana", () => {
    const ag = calcularAgenda(sp("12T10:00"));
    expect(ag.modo).toBe("fechada");
    expect(ag.agora).toBe(false);
    expect(ag.abreEm).toBe(sp("17T13:00").getTime());
    expect(faixas(ag)).toEqual([
      ["2026-10-17", TODAS],
      ["2026-10-18", TODAS],
      ["2026-10-24", TODAS],
      ["2026-10-25", TODAS],
    ]);
    expect(textosAgenda(ag, sp("12T10:00").getTime()).texto).toBe(
      "Abrimos sábado, 17/10, às 13h. Você já pode fazer o pedido e agendar o horário.",
    );
  });

  it("sábado 10h: fechado, abre hoje às 13h", () => {
    const ag = calcularAgenda(sp("17T10:00"));
    expect(ag.modo).toBe("fechada");
    expect(ag.abreEm).toBe(sp("17T13:00").getTime());
    expect(textosAgenda(ag, sp("17T10:00").getTime())).toMatchObject({
      selo: "Fechado agora",
      contagem: "Abre em 3h 00min.",
      texto: "Abrimos hoje às 13h. Você já pode fazer o pedido e agendar o horário.",
    });
    expect(faixas(ag)[0]).toEqual(["2026-10-17", TODAS]);
  });

  it("sábado 13h30: aberto, aceita 'o quanto antes' e faixas com 1h de antecedência", () => {
    const ag = calcularAgenda(sp("17T13:30"));
    expect(ag.modo).toBe("aberta");
    expect(ag.agora).toBe(true);
    expect(ag.fechaEm).toBe(sp("17T18:00").getTime());
    expect(faixas(ag).slice(0, 2)).toEqual([
      ["2026-10-17", ["15h", "16h", "17h"]],
      ["2026-10-18", TODAS],
    ]);
    expect(textosAgenda(ag, sp("17T13:30").getTime()).contagem).toBe("Fecha em 4h 30min.");
  });

  it("sábado 17h40: aberto, mas 'o quanto antes' encerrou; agenda domingo e o sábado seguinte", () => {
    const ag = calcularAgenda(sp("17T17:40"));
    expect(ag.modo).toBe("aberta");
    expect(ag.agora).toBe(false);
    expect(faixas(ag).map(([d]) => d)).toEqual(["2026-10-18", "2026-10-24", "2026-10-25", "2026-10-31"]);
  });

  it("sábado 18h: fechado, abre domingo às 13h", () => {
    const ag = calcularAgenda(sp("17T18:00"));
    expect(ag.modo).toBe("fechada");
    expect(ag.abreEm).toBe(sp("18T13:00").getTime());
  });

  it("domingo 17h: aberto para agora; agendamento só nos fins de semana seguintes", () => {
    const ag = calcularAgenda(sp("18T17:00"));
    expect(ag.agora).toBe(true);
    expect(faixas(ag).map(([d]) => d)).toEqual(["2026-10-24", "2026-10-25", "2026-10-31", "2026-11-01"]);
  });

  it("domingo 19h: fechado até o sábado seguinte", () => {
    const ag = calcularAgenda(sp("18T19:00"));
    expect(ag.modo).toBe("fechada");
    expect(ag.abreEm).toBe(new Date("2026-10-24T13:00:00-03:00").getTime());
    expect(faixas(ag).map(([d]) => d)).toEqual(["2026-10-24", "2026-10-25", "2026-10-31", "2026-11-01"]);
  });

  it("nunca fica sem horário para agendar", () => {
    for (const quando of ["12T00:00", "14T12:00", "16T23:59", "17T12:59", "18T17:59", "18T23:59"]) {
      expect(calcularAgenda(sp(quando)).dias.length).toBe(4);
    }
  });

  it("modo teste: sempre aberto, com 'o quanto antes' e todas as faixas", () => {
    const ag = calcularAgenda(sp("14T03:00"), { modoTeste: true });
    expect(ag.modo).toBe("aberta");
    expect(ag.agora).toBe(true);
    expect(ag.dias.every((d) => d.janelas.length === 5)).toBe(true);
    expect(textosAgenda(ag, sp("14T03:00").getTime()).selo).toBe("Modo teste");
  });

  it("não depende do fuso do aparelho", () => {
    // Sábado 13h30 em SP = 16h30 UTC.
    expect(calcularAgenda(new Date("2026-10-17T16:30:00Z")).agora).toBe(true);
  });
});

describe("escolha de horário", () => {
  it("'o quanto antes' só vale com a loja aberta", () => {
    expect(horarioValido(calcularAgenda(sp("17T14:00")), CHAVE_AGORA)).toBe(true);
    expect(horarioValido(calcularAgenda(sp("12T14:00")), CHAVE_AGORA)).toBe(false);
  });

  it("faixa que já passou deixa de valer", () => {
    expect(horarioValido(calcularAgenda(sp("12T10:00")), "2026-10-17|13h")).toBe(true);
    expect(horarioValido(calcularAgenda(sp("17T13:30")), "2026-10-17|13h")).toBe(false);
  });

  it("textos para a mensagem", () => {
    const ag = calcularAgenda(sp("17T14:00"));
    expect(textoHorario(ag, CHAVE_AGORA)).toBe("O quanto antes (hoje, 17/10)");
    expect(textoHorario(ag, "2026-10-18|14h")).toBe("Domingo, 18/10 · 14h às 15h");
  });
});
