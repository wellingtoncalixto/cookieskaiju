import { describe, expect, it } from "vitest";
import { calcularAgenda, textosAgenda } from "@/lib/agenda";

// Semana de referência: seg 12/10/2026 … dom 18/10/2026 (horário de São Paulo, UTC-3).
const sp = (diaHora: string) => new Date(`2026-10-${diaHora}:00-03:00`);
const janelas = (ag: ReturnType<typeof calcularAgenda>) =>
  ag.dias.map((d) => [d.data, d.janelas.map((j) => j.id)]);

describe("calcularAgenda", () => {
  it("segunda 10h: fechada, abre quarta às 9h", () => {
    const ag = calcularAgenda(sp("12T10:00"));
    expect(ag.modo).toBe("fechada");
    expect(ag.proxima).toBe("agenda");
    expect(ag.abreEm).toBe(sp("14T09:00").getTime());
    expect(textosAgenda(ag, sp("12T10:00").getTime()).contagem).toBe("Abre em 1d 23h 00min.");
  });

  it("quarta 8h59: fechada", () => {
    const ag = calcularAgenda(sp("14T08:59"));
    expect(ag.modo).toBe("fechada");
    expect(ag.abreEm).toBe(sp("14T09:00").getTime());
  });

  it("quarta 9h: aberta, sábado e domingo com 2 janelas cada", () => {
    const ag = calcularAgenda(sp("14T09:00"));
    expect(ag.modo).toBe("aberta");
    expect(janelas(ag)).toEqual([
      ["2026-10-17", ["tarde", "noite"]],
      ["2026-10-18", ["tarde", "noite"]],
    ]);
    expect(ag.fechaEm).toBe(sp("16T12:00").getTime());
    expect(textosAgenda(ag, sp("14T09:00").getTime()).contagem).toBe("Fecha em 2d 3h 00min.");
  });

  it("sexta 11h59: aberta", () => {
    expect(calcularAgenda(sp("16T11:59")).modo).toBe("aberta");
  });

  it("sexta 12h: fechada, volta sábado às 8h", () => {
    const ag = calcularAgenda(sp("16T12:00"));
    expect(ag.modo).toBe("fechada");
    expect(ag.proxima).toBe("estoque");
    expect(ag.abreEm).toBe(sp("17T08:00").getTime());
    expect(textosAgenda(ag, sp("16T12:00").getTime()).texto).toBe(
      "Pronta-entrega volta sábado às 8h, conforme estoque.",
    );
  });

  it("sábado 7h: fechada", () => {
    const ag = calcularAgenda(sp("17T07:00"));
    expect(ag.modo).toBe("fechada");
    expect(ag.abreEm).toBe(sp("17T08:00").getTime());
  });

  it("sábado 12h30: pronta-entrega, sábado só 18h e domingo com as duas", () => {
    const ag = calcularAgenda(sp("17T12:30"));
    expect(ag.modo).toBe("estoque");
    expect(janelas(ag)).toEqual([
      ["2026-10-17", ["noite"]],
      ["2026-10-18", ["tarde", "noite"]],
    ]);
  });

  it("sábado 17h30: pronta-entrega só domingo", () => {
    const ag = calcularAgenda(sp("17T17:30"));
    expect(ag.modo).toBe("estoque");
    expect(janelas(ag)).toEqual([["2026-10-18", ["tarde", "noite"]]]);
  });

  it("domingo 17h01: fechada até quarta", () => {
    const ag = calcularAgenda(sp("18T17:01"));
    expect(ag.modo).toBe("fechada");
    expect(ag.proxima).toBe("agenda");
    expect(ag.abreEm).toBe(new Date("2026-10-21T09:00:00-03:00").getTime());
    expect(textosAgenda(ag, sp("18T17:01").getTime()).texto).toBe(
      "A próxima agenda abre quarta, 21/10, às 9h.",
    );
  });

  it.each(["12T10:00", "14T08:59", "16T15:00", "17T07:00", "18T23:00"])(
    "modo teste (%s): próximo sábado e domingo liberados",
    (quando) => {
      const ag = calcularAgenda(sp(quando), { modoTeste: true });
      expect(ag.modo).toBe("aberta");
      expect(ag.teste).toBe(true);
      expect(ag.dias.map((d) => d.diaSemana)).toEqual([6, 0]);
      expect(ag.dias.every((d) => d.janelas.length === 2)).toBe(true);
      expect(textosAgenda(ag, sp(quando).getTime()).selo).toBe("Modo teste");
    },
  );

  it("não depende do fuso do aparelho: o mesmo instante em UTC dá o mesmo resultado", () => {
    // Sábado 12h30 em SP = 15h30 UTC.
    const ag = calcularAgenda(new Date("2026-10-17T15:30:00Z"));
    expect(ag.modo).toBe("estoque");
    expect(ag.dias[0].janelas.map((j) => j.id)).toEqual(["noite"]);
  });
});
