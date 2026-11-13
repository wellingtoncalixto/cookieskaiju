import { loja, type Janela } from "@/config/loja";
import { faixaDeId, faixasDoDia, hora, horarioPadrao, type HorarioSemana } from "@/lib/horario";
import {
  DIAS,
  contagem,
  dataDeIso,
  ddmm,
  instanteDaParede,
  inicioDoDia,
  isoData,
  minutosDoDia,
  paredeSP,
  somarDias,
} from "@/lib/tempo";

export { hora } from "@/lib/horario";

/**
 * Funcionamento: o horário de cada dia da semana (admin → Horário). O cliente sempre pode fazer o pedido.
 * - Padrão (para hoje): não escolhe horário; recebe entre 60 e 90 minutos depois do pedido (ou da
 *   abertura, se pedir antes de abrir). Aceito até o fechamento do dia.
 * - Agendar: escolhe uma faixa de 1 hora (dentro do horário daquele dia), hoje (as que ainda dão tempo)
 *   ou nos próximos dias.
 */

export type ModoAgenda = "aberta" | "fechada";

/**
 * Chave do admin (tabela estado_loja): "automatico" segue o horário de funcionamento; "aberto" e "fechado"
 * são o modo manual ("Loja aberta agora" ligado ou desligado), que volta sozinho ao automático à meia-noite.
 */
export type ModoLoja = "automatico" | "aberto" | "fechado";

export type DiaEntrega = {
  /** AAAA-MM-DD (data em São Paulo). */
  data: string;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  /** Faixas para agendar neste dia (hoje: só as que ainda dão tempo). */
  janelas: Janela[];
  /** Todas as faixas do horário deste dia (para mostrar as que já passaram, desativadas). */
  todas: Janela[];
};

export type Agenda = {
  /** A loja está funcionando neste momento? */
  modo: ModoAgenda;
  teste: boolean;
  /** Aberto ou fechado à mão pelo admin (null = segue o horário). */
  manual: Exclude<ModoLoja, "automatico"> | null;
  /** Pedido para hoje disponível (sem escolher horário). */
  agora: boolean;
  /** Previsão de entrega do pedido para hoje (instantes reais, ms). */
  previsao: { de: number; ate: number } | null;
  /** Pedido para hoje feito antes da abertura: o prazo conta a partir da abertura. */
  antesDeAbrir: boolean;
  /** AAAA-MM-DD de hoje em São Paulo. */
  hoje: string;
  /** Dias com as faixas para agendar: hoje (as que ainda dão tempo, se houver) e os próximos de funcionamento. */
  dias: DiaEntrega[];
  /** Instante real (ms) em que a loja fecha hoje, quando aberta pelo horário. */
  fechaEm: number | null;
  /** Instante real (ms) da próxima abertura, quando fechada pelo horário (null se nenhum dia abre). */
  abreEm: number | null;
};

/** Chave do pedido para hoje. As faixas agendadas usam "AAAA-MM-DD|id". */
export const CHAVE_AGORA = "agora";

type Opcoes = {
  modoTeste?: boolean;
  /**
   * Chave do admin. "fechado" (manual): avisa que está fechado e só deixa agendar para outros dias.
   * "aberto" (manual): libera o pedido para hoje.
   */
  modoLoja?: ModoLoja;
  /** Horário de funcionamento (padrão: o de src/config/loja.ts). */
  horario?: HorarioSemana;
  config?: Pick<typeof loja, "agenda">;
};

/** Calcula a situação da loja num instante, sempre no horário de São Paulo. */
export function calcularAgenda(agora: Date | number, opcoes: Opcoes = {}): Agenda {
  const { agenda: A } = opcoes.config ?? loja;
  const H = opcoes.horario ?? horarioPadrao();
  const teste = !!opcoes.modoTeste;
  const parede = paredeSP(agora);
  const dow = parede.getUTCDay();
  const min = minutosDoDia(parede);
  const manual = opcoes.modoLoja && opcoes.modoLoja !== "automatico" ? opcoes.modoLoja : null;
  const fechadoAMao = manual === "fechado";
  const hojeH = H[dow];
  const abertoHoje = !!hojeH?.aberto;
  const em = (offsetDias: number, minuto: number) =>
    instanteDaParede(new Date(inicioDoDia(parede) + offsetDias * 86_400_000 + minuto * 60_000));

  const noHorario = abertoHoje && min >= hojeH.abre && min < hojeH.fecha;
  const aberta = manual ? manual === "aberto" : noHorario;

  // Pedido para hoje: dia de funcionamento e antes do fechamento (ou o que o admin decidiu).
  const hojeDisponivel = fechadoAMao
    ? false
    : teste || manual === "aberto" || (abertoHoje && min < hojeH.fecha);
  const base = teste || manual === "aberto" || !abertoHoje ? min : Math.max(min, hojeH.abre);
  const previsao = hojeDisponivel
    ? { de: em(0, base + A.prazoMinimoMin), ate: em(0, base + A.prazoMaximoMin) }
    : null;

  // Hoje vem primeiro (exceto fechado à mão), só com as faixas que começam depois do prazo mínimo.
  // Depois, os próximos dias de funcionamento, com as faixas do horário de cada um.
  const dias: DiaEntrega[] = [];
  if (!fechadoAMao) {
    const todas = faixasDoDia(hojeH);
    const restantes = todas.filter((j) => j.inicio >= min + A.prazoMinimoMin);
    if (restantes.length) dias.push({ data: isoData(parede), diaSemana: dow, janelas: restantes, todas });
  }
  const total = dias.length + A.diasParaAgendar;
  for (let off = 1; off <= 56 && dias.length < total; off++) {
    const d = somarDias(parede, off);
    const faixas = faixasDoDia(H[d.getUTCDay()]);
    if (!faixas.length) continue;
    dias.push({
      data: isoData(d),
      diaSemana: d.getUTCDay(),
      janelas: faixas,
      todas: faixas.map((j) => ({ ...j })),
    });
  }

  let abreEm: number | null = null;
  if (!aberta) {
    if (abertoHoje && min < hojeH.abre) abreEm = em(0, hojeH.abre);
    else
      for (let off = 1; off <= 7; off++) {
        const d = H[somarDias(parede, off).getUTCDay()];
        if (d?.aberto) {
          abreEm = em(off, d.abre);
          break;
        }
      }
  }

  return {
    modo: (aberta || teste) && !fechadoAMao ? "aberta" : "fechada",
    teste,
    manual,
    agora: hojeDisponivel,
    previsao,
    antesDeAbrir: hojeDisponivel && !aberta && !teste && !manual,
    hoje: isoData(parede),
    dias,
    fechaEm: aberta && noHorario && !manual ? em(0, hojeH.fecha) : null,
    abreEm: aberta || teste || manual ? null : abreEm,
  };
}

/** Chave estável de uma faixa agendada: "2026-10-24|14h". */
export const chaveHorario = (data: string, janelaId: string) => `${data}|${janelaId}`;

/** A escolha de horário ainda vale na situação atual? */
export function horarioValido(agenda: Agenda, chave: string | null | undefined): boolean {
  if (!chave) return false;
  if (chave === CHAVE_AGORA) return agenda.agora;
  return agenda.dias.some((d) => d.janelas.some((j) => chaveHorario(d.data, j.id) === chave));
}

/** Há algum dia para agendar? Sem dias, o checkout mostra só o "Padrão" (pedido para hoje). */
export const podeAgendar = (agenda: Agenda) => agenda.dias.length > 0;

/**
 * O checkout está em "Agendar"? Sem pedido para hoje, sempre (só resta agendar). Com pedido para hoje,
 * quando o cliente tocou em "Agendar" ou já escolheu uma faixa, e só se houver dia para agendar.
 */
export function quandoAgendado(agenda: Agenda, agendarTocado: boolean, chave: string | null | undefined) {
  if (!agenda.agora) return true;
  return podeAgendar(agenda) && (agendarTocado || (!!chave && chave !== CHAVE_AGORA));
}

/** Data (AAAA-MM-DD) do pedido para a escolha de horário: hoje, se for o pedido para hoje. */
export const dataDoHorario = (agenda: Agenda | null, chave: string | null | undefined) =>
  chave === CHAVE_AGORA ? (agenda?.hoje ?? null) : (chave?.split("|")[0] ?? null);

/** Instante real → "15h10" no horário de São Paulo. */
export const horaDe = (instante: number) => hora(minutosDoDia(paredeSP(instante)));

/** "entre 15h10 e 15h40" */
export const textoPrevisao = (ag: Agenda) =>
  ag.previsao ? `entre ${horaDe(ag.previsao.de)} e ${horaDe(ag.previsao.ate)}` : "";

/** Textos do status: selo, contagem regressiva e frase. Usados na home e na etapa de entrega. */
export function textosAgenda(ag: Agenda, agora: number, A: (typeof loja)["agenda"] = loja.agenda) {
  const prazo = `${A.prazoMinimoMin} a ${A.prazoMaximoMin} minutos`;
  if (ag.teste) {
    return { selo: "Modo teste", contagem: "", texto: "Pedidos liberados a qualquer hora (modo teste)." };
  }
  if (ag.manual === "fechado") {
    return {
      selo: "Fechado agora",
      contagem: "",
      texto: ag.dias.length
        ? "No momento não estamos recebendo pedidos para hoje. Você pode fazer o pedido e agendar para outro dia."
        : "No momento não estamos recebendo pedidos. Fale com a gente pelo WhatsApp.",
    };
  }
  if (ag.modo === "aberta") {
    return {
      selo: "Aberto agora",
      contagem: ag.fechaEm ? `Fecha em ${contagem(ag.fechaEm - agora)}.` : "",
      texto: ag.agora
        ? `Delivery em ${prazo}. Peça agora ou agende um horário.`
        : "Os pedidos para hoje já encerraram. Agende o seu para o próximo dia.",
    };
  }
  if (!ag.abreEm) {
    return {
      selo: "Fechado agora",
      contagem: "",
      texto: "No momento não temos horários para agendar. Fale com a gente pelo WhatsApp.",
    };
  }
  const contagemAbre = `Abre em ${contagem(ag.abreEm - agora)}.`;
  if (ag.antesDeAbrir) {
    return {
      selo: "Fechado agora",
      contagem: contagemAbre,
      texto: `Abrimos hoje às ${horaDe(ag.abreEm)}. Peça agora e receba ${textoPrevisao(ag)}.`,
    };
  }
  const abre = paredeSP(ag.abreEm);
  return {
    selo: "Fechado agora",
    contagem: contagemAbre,
    texto: `Abrimos ${DIAS[abre.getUTCDay()]}, ${ddmm(abre)}, às ${horaDe(ag.abreEm)}. Você já pode fazer o pedido e agendar o horário.`,
  };
}

/**
 * Texto do horário para a mensagem e a comanda:
 * "Hoje, 24/10 · entre 15h10 e 15h40 (60 a 90 min após o pedido)" ou "Sábado, 31/10 · 14h às 15h".
 */
export function textoHorario(
  agenda: Agenda | null,
  chave: string | null | undefined,
  A: (typeof loja)["agenda"] = loja.agenda,
): string {
  if (!chave) return "";
  if (chave === CHAVE_AGORA) {
    if (!agenda) return "Hoje";
    const desde = agenda.antesDeAbrir ? "após a abertura" : "após o pedido";
    return `Hoje, ${ddmm(dataDeIso(agenda.hoje))} · ${textoPrevisao(agenda)} (${A.prazoMinimoMin} a ${A.prazoMaximoMin} min ${desde})`;
  }
  const [data, id] = chave.split("|");
  const j = faixaDeId(id);
  if (!data || !j) return "";
  const d = dataDeIso(data);
  const dia = data === agenda?.hoje ? "Hoje" : DIAS[d.getUTCDay()].replace(/^./, (c) => c.toUpperCase());
  return `${dia}, ${ddmm(d)} · ${j.nome}`;
}
