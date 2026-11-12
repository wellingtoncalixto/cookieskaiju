import { describe, expect, it } from "vitest";
import {
  CHAVE_AGORA,
  calcularAgenda,
  horarioValido,
  podeAgendar,
  quandoAgendado,
  textoHorario,
  textosAgenda,
} from "@/lib/agenda";
import { horarioPadrao, type HorarioSemana } from "@/lib/horario";

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
    // Também dá para agendar hoje, em qualquer faixa (todas começam depois de 11h).
    expect(dias(ag)).toEqual(["2026-10-17", "2026-10-18", "2026-10-24", "2026-10-25", "2026-10-31"]);
    expect(ag.dias[0].janelas.map((j) => j.id)).toEqual(TODAS);
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
      texto: "Delivery em 60 a 90 minutos. Peça agora ou agende um horário.",
    });
    expect(textoHorario(ag, CHAVE_AGORA)).toBe(
      "Hoje, 17/10 · entre 15h10 e 15h40 (60 a 90 min após o pedido)",
    );
  });

  it("sábado 17h59: ainda aceita pedido para hoje, até o fechamento (entrega 18h59 a 19h29)", () => {
    const ag = calcularAgenda(sp("17T17:59"));
    expect(ag.modo).toBe("aberta");
    expect(ag.agora).toBe(true);
    expect(ag.previsao).toEqual({ de: sp("17T18:59").getTime(), ate: sp("17T19:29").getTime() });
    // Nenhuma faixa de hoje dá mais tempo: o agendamento começa amanhã.
    expect(dias(ag)[0]).toBe("2026-10-18");
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
      expect(calcularAgenda(sp(quando)).dias.length).toBeGreaterThanOrEqual(4);
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
  it("pedido para hoje só vale em dia de funcionamento, até as 18h", () => {
    expect(horarioValido(calcularAgenda(sp("17T14:00")), CHAVE_AGORA)).toBe(true);
    expect(horarioValido(calcularAgenda(sp("17T17:30")), CHAVE_AGORA)).toBe(true);
    expect(horarioValido(calcularAgenda(sp("17T18:00")), CHAVE_AGORA)).toBe(false);
    expect(horarioValido(calcularAgenda(sp("12T14:00")), CHAVE_AGORA)).toBe(false);
  });

  it("agenda hoje as faixas que começam depois do prazo mínimo, e as dos próximos dias", () => {
    const ag = calcularAgenda(sp("17T14:00"));
    expect(horarioValido(ag, "2026-10-17|14h")).toBe(false);
    expect(horarioValido(ag, "2026-10-17|15h")).toBe(true);
    expect(horarioValido(ag, "2026-10-17|16h")).toBe(true);
    expect(textoHorario(ag, "2026-10-17|16h")).toBe("Hoje, 17/10 · 16h às 17h");
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

// Horário com dias diferentes: sexta 18h–22h, sábado 10h–14h30, domingo fechado, quarta 13h30–16h.
const VARIADO: HorarioSemana = (() => {
  const h = horarioPadrao().map((d) => ({ ...d, aberto: false }));
  h[5] = { aberto: true, abre: 18 * 60, fecha: 22 * 60 };
  h[6] = { aberto: true, abre: 10 * 60, fecha: 14 * 60 + 30 };
  h[3] = { aberto: true, abre: 13 * 60 + 30, fecha: 16 * 60 };
  return h;
})();
const ids = (ag: ReturnType<typeof calcularAgenda>, i: number) => ag.dias[i].janelas.map((j) => j.id);

describe("horário de funcionamento por dia", () => {
  it("faixas geradas dentro do horário de cada dia (sem passar do fechamento)", () => {
    const ag = calcularAgenda(sp("12T10:00"), { horario: VARIADO });
    expect(dias(ag)).toEqual(["2026-10-14", "2026-10-16", "2026-10-17", "2026-10-21"]);
    expect(ids(ag, 0)).toEqual(["13h30", "14h30"]); // quarta 13h30–16h: a das 15h30 passaria das 16h
    expect(ids(ag, 1)).toEqual(["18h", "19h", "20h", "21h"]); // sexta 18h–22h
    expect(ids(ag, 2)).toEqual(["10h", "11h", "12h", "13h"]); // sábado 10h–14h30
    expect(ag.dias[0].janelas[0]).toEqual({ id: "13h30", inicio: 810, fim: 870, nome: "13h30 às 14h30" });
    expect(textoHorario(ag, "2026-10-14|13h30")).toBe("Quarta, 14/10 · 13h30 às 14h30");
    expect(horarioValido(ag, "2026-10-14|13h30")).toBe(true);
    // Faixa que existe no padrão, mas não no horário deste dia.
    expect(horarioValido(ag, "2026-10-17|14h")).toBe(false);
    expect(horarioValido(ag, "2026-10-14|13h")).toBe(false);
  });

  it("dia fechado não entra na agenda nem abre; a próxima abertura usa a hora daquele dia", () => {
    const ag = calcularAgenda(sp("18T12:00"), { horario: VARIADO }); // domingo, fechado
    expect(ag.modo).toBe("fechada");
    expect(ag.agora).toBe(false);
    expect(ag.dias.some((d) => d.diaSemana === 0)).toBe(false);
    expect(ag.abreEm).toBe(sp("21T13:30").getTime());
    expect(textosAgenda(ag, sp("18T12:00").getTime()).texto).toBe(
      "Abrimos quarta, 21/10, às 13h30. Você já pode fazer o pedido e agendar o horário.",
    );
  });

  it("pedido para hoje vai até o fechamento do dia (sexta 18h–22h)", () => {
    const antes = calcularAgenda(sp("16T15:00"), { horario: VARIADO });
    expect(antes.agora).toBe(true);
    expect(antes.antesDeAbrir).toBe(true);
    expect(antes.previsao?.de).toBe(sp("16T19:00").getTime());
    expect(textosAgenda(antes, sp("16T15:00").getTime()).texto).toBe(
      "Abrimos hoje às 18h. Peça agora e receba entre 19h e 19h30.",
    );
    // Hoje: faixas que começam depois do prazo mínimo (15h + 60 min).
    expect(ids(antes, 0)).toEqual(["18h", "19h", "20h", "21h"]);

    const aberta = calcularAgenda(sp("16T21:59"), { horario: VARIADO });
    expect(aberta.modo).toBe("aberta");
    expect(aberta.agora).toBe(true);
    expect(aberta.fechaEm).toBe(sp("16T22:00").getTime());
    expect(horarioValido(aberta, CHAVE_AGORA)).toBe(true);

    const fechou = calcularAgenda(sp("16T22:00"), { horario: VARIADO });
    expect(fechou.modo).toBe("fechada");
    expect(fechou.agora).toBe(false);
    expect(fechou.abreEm).toBe(sp("17T10:00").getTime());
  });

  it("sábado 13h com fechamento às 14h30: nenhuma faixa de hoje dá tempo, mas o pedido para hoje vale", () => {
    const ag = calcularAgenda(sp("17T13:00"), { horario: VARIADO });
    expect(ag.agora).toBe(true);
    expect(ag.dias[0].data).toBe("2026-10-21");
  });

  it("nenhum dia aberto: sem agenda e sem próxima abertura, com aviso no texto", () => {
    const fechado = horarioPadrao().map((d) => ({ ...d, aberto: false }));
    const ag = calcularAgenda(sp("17T14:00"), { horario: fechado });
    expect(ag.modo).toBe("fechada");
    expect(ag.agora).toBe(false);
    expect(ag.dias).toEqual([]);
    expect(ag.abreEm).toBeNull();
    expect(textosAgenda(ag, sp("17T14:00").getTime())).toEqual({
      selo: "Fechado agora",
      contagem: "",
      texto: "No momento não temos horários para agendar. Fale com a gente pelo WhatsApp.",
    });
  });

  it("sem horário informado: vale o padrão (sábado e domingo, 13h às 18h)", () => {
    expect(calcularAgenda(sp("17T15:00"), { horario: horarioPadrao() })).toEqual(
      calcularAgenda(sp("17T15:00")),
    );
  });
});

describe("modo manual", () => {
  it("manual aberto num dia fechado: libera o pedido para hoje; sem faixas hoje (o dia não tem horário)", () => {
    const ag = calcularAgenda(sp("18T15:00"), { horario: VARIADO, modoLoja: "aberto" });
    expect(ag.modo).toBe("aberta");
    expect(ag.manual).toBe("aberto");
    expect(ag.agora).toBe(true);
    expect(ag.fechaEm).toBeNull();
    expect(ag.previsao).toEqual({ de: sp("18T16:00").getTime(), ate: sp("18T16:30").getTime() });
    expect(ag.dias[0].data).toBe("2026-10-21");
  });

  it("manual aberto depois do fechamento: continua aceitando o pedido para hoje", () => {
    const ag = calcularAgenda(sp("17T20:00"), { modoLoja: "aberto" });
    expect(ag.agora).toBe(true);
    expect(horarioValido(ag, CHAVE_AGORA)).toBe(true);
  });

  it("manual fechado dentro do horário: só agenda para outros dias", () => {
    const ag = calcularAgenda(sp("16T19:00"), { horario: VARIADO, modoLoja: "fechado" });
    expect(ag.modo).toBe("fechada");
    expect(ag.agora).toBe(false);
    expect(ag.dias.some((d) => d.data === "2026-10-16")).toBe(false);
    expect(horarioValido(ag, "2026-10-16|21h")).toBe(false);
    expect(horarioValido(ag, "2026-10-17|10h")).toBe(true);
  });

  it("manual aberto sem nenhum dia aberto: o checkout mostra só o Padrão (sem Agendar vazio)", () => {
    const nenhum = horarioPadrao().map((d) => ({ ...d, aberto: false }));
    const ag = calcularAgenda(sp("17T15:00"), { horario: nenhum, modoLoja: "aberto" });
    expect(ag.agora).toBe(true);
    expect(ag.dias).toEqual([]);
    expect(podeAgendar(ag)).toBe(false);
    // Mesmo que "Agendar" tenha sido tocado antes, fica no Padrão; e o Padrão vale.
    expect(quandoAgendado(ag, true, null)).toBe(false);
    expect(quandoAgendado(ag, false, "2026-10-17|14h")).toBe(false);
    expect(horarioValido(ag, CHAVE_AGORA)).toBe(true);
  });

  it("quandoAgendado: sem pedido para hoje, só agendar; com dias, segue a escolha do cliente", () => {
    const fechado = calcularAgenda(sp("12T10:00"));
    expect(quandoAgendado(fechado, false, null)).toBe(true);
    const aberto = calcularAgenda(sp("17T14:00"));
    expect(podeAgendar(aberto)).toBe(true);
    expect(quandoAgendado(aberto, false, null)).toBe(false);
    expect(quandoAgendado(aberto, false, CHAVE_AGORA)).toBe(false);
    expect(quandoAgendado(aberto, true, null)).toBe(true);
    expect(quandoAgendado(aberto, false, "2026-10-17|16h")).toBe(true);
  });

  it("manual fechado sem nenhum outro dia aberto: avisa para falar no WhatsApp", () => {
    const so = horarioPadrao().map((d) => ({ ...d, aberto: false }));
    const ag = calcularAgenda(sp("17T15:00"), { horario: so, modoLoja: "fechado" });
    expect(textosAgenda(ag, sp("17T15:00").getTime()).texto).toBe(
      "No momento não estamos recebendo pedidos. Fale com a gente pelo WhatsApp.",
    );
  });
});
