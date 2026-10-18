import { loja, type Janela } from "@/config/loja";
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

/**
 * Funcionamento: sábado e domingo, das 13h às 18h, com delivery. O cliente sempre pode fazer o pedido.
 * - Para hoje: não escolhe horário; recebe entre 60 e 90 minutos depois do pedido (ou da abertura,
 *   se pedir antes de abrir). Aceito até `pedidoHojeAteMin`.
 * - Para os próximos dias de funcionamento: escolhe uma faixa de 1 hora.
 */

export type ModoAgenda = "aberta" | "fechada";

export type DiaEntrega = {
  /** AAAA-MM-DD (data em São Paulo). */
  data: string;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  /** Faixas para agendar neste dia. */
  janelas: Janela[];
};

export type Agenda = {
  /** A loja está funcionando neste momento? */
  modo: ModoAgenda;
  teste: boolean;
  /** Pedido para hoje disponível (sem escolher horário). */
  agora: boolean;
  /** Previsão de entrega do pedido para hoje (instantes reais, ms). */
  previsao: { de: number; ate: number } | null;
  /** Pedido para hoje feito antes da abertura: o prazo conta a partir da abertura. */
  antesDeAbrir: boolean;
  /** AAAA-MM-DD de hoje em São Paulo. */
  hoje: string;
  /** Próximos dias de funcionamento (depois de hoje) com as faixas para agendar. */
  dias: DiaEntrega[];
  /** Instante real (ms) em que a loja fecha hoje, quando aberta. */
  fechaEm: number | null;
  /** Instante real (ms) da próxima abertura, quando fechada. */
  abreEm: number | null;
};

/** Chave do pedido para hoje. As faixas agendadas usam "AAAA-MM-DD|id". */
export const CHAVE_AGORA = "agora";

type Opcoes = {
  modoTeste?: boolean;
  config?: Pick<typeof loja, "agenda" | "janelas">;
};

/** Calcula a situação da loja num instante, sempre no horário de São Paulo. */
export function calcularAgenda(agora: Date | number, opcoes: Opcoes = {}): Agenda {
  const { agenda: A, janelas } = opcoes.config ?? loja;
  const teste = !!opcoes.modoTeste;
  const parede = paredeSP(agora);
  const dow = parede.getUTCDay();
  const min = minutosDoDia(parede);
  const abertoNoDia = (d: number) => (A.diasAbertos as readonly number[]).includes(d);
  const em = (offsetDias: number, minuto: number) =>
    instanteDaParede(new Date(inicioDoDia(parede) + offsetDias * 86_400_000 + minuto * 60_000));

  const aberta = abertoNoDia(dow) && min >= A.abreMin && min < A.fechaMin;

  // Pedido para hoje: dia de funcionamento e ainda dentro do horário-limite.
  const hojeDisponivel = teste || (abertoNoDia(dow) && min <= A.pedidoHojeAteMin);
  const base = teste ? min : Math.max(min, A.abreMin);
  const previsao = hojeDisponivel
    ? { de: em(0, base + A.prazoMinimoMin), ate: em(0, base + A.prazoMaximoMin) }
    : null;

  // Próximos dias de funcionamento (a partir de amanhã), com todas as faixas.
  const dias: DiaEntrega[] = [];
  for (let off = 1; off <= 56 && dias.length < A.diasParaAgendar; off++) {
    const d = somarDias(parede, off);
    if (!abertoNoDia(d.getUTCDay())) continue;
    dias.push({ data: isoData(d), diaSemana: d.getUTCDay(), janelas: janelas.map((j) => ({ ...j })) });
  }

  let abreEm: number | null = null;
  if (!aberta) {
    if (abertoNoDia(dow) && min < A.abreMin) abreEm = em(0, A.abreMin);
    else
      for (let off = 1; off <= 7; off++)
        if (abertoNoDia(somarDias(parede, off).getUTCDay())) {
          abreEm = em(off, A.abreMin);
          break;
        }
  }

  return {
    modo: aberta || teste ? "aberta" : "fechada",
    teste,
    agora: hojeDisponivel,
    previsao,
    antesDeAbrir: hojeDisponivel && !aberta && !teste,
    hoje: isoData(parede),
    dias,
    fechaEm: aberta ? em(0, A.fechaMin) : null,
    abreEm: aberta || teste ? null : abreEm,
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

/** Data (AAAA-MM-DD) do pedido para a escolha de horário: hoje, se for o pedido para hoje. */
export const dataDoHorario = (agenda: Agenda | null, chave: string | null | undefined) =>
  chave === CHAVE_AGORA ? (agenda?.hoje ?? null) : (chave?.split("|")[0] ?? null);

/** 780 → "13h"; 790 → "13h10". */
const hora = (min: number) => `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`;

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
  if (ag.modo === "aberta") {
    return {
      selo: "Aberto agora",
      contagem: `Fecha em ${contagem(ag.fechaEm! - agora)}.`,
      texto: ag.agora
        ? `Delivery em ${prazo}. Peça agora ou agende para outro dia.`
        : `Pedidos para hoje vão até as ${hora(A.pedidoHojeAteMin)}. Agende o seu para o próximo dia.`,
    };
  }
  const contagemAbre = `Abre em ${contagem(ag.abreEm! - agora)}.`;
  if (ag.antesDeAbrir) {
    return {
      selo: "Fechado agora",
      contagem: contagemAbre,
      texto: `Abrimos hoje às ${hora(A.abreMin)}. Peça agora e receba ${textoPrevisao(ag)}.`,
    };
  }
  const abre = paredeSP(ag.abreEm!);
  return {
    selo: "Fechado agora",
    contagem: contagemAbre,
    texto: `Abrimos ${DIAS[abre.getUTCDay()]}, ${ddmm(abre)}, às ${hora(A.abreMin)}. Você já pode fazer o pedido e agendar o horário.`,
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
  const j = loja.janelas.find((x) => x.id === id);
  if (!data || !j) return "";
  const d = dataDeIso(data);
  return `${DIAS[d.getUTCDay()].replace(/^./, (c) => c.toUpperCase())}, ${ddmm(d)} · ${j.nome}`;
}

/** "13h às 18h" (horário de funcionamento, para os textos do site). */
export const HORARIO_FUNCIONAMENTO = `${hora(loja.agenda.abreMin)} às ${hora(loja.agenda.fechaMin)}`;
