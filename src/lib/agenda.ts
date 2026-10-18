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
 * Funcionamento: sábado e domingo, das 13h às 18h, com delivery.
 * O cliente sempre pode fazer o pedido: com a loja aberta, pode pedir "o quanto antes";
 * a qualquer momento, pode agendar uma faixa de horário nos próximos dias de funcionamento.
 */

export type ModoAgenda = "aberta" | "fechada";

export type DiaEntrega = {
  /** AAAA-MM-DD (data em São Paulo). */
  data: string;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  /** Faixas que ainda dá para agendar neste dia. */
  janelas: Janela[];
};

export type Agenda = {
  /** A loja está funcionando neste momento? */
  modo: ModoAgenda;
  teste: boolean;
  /** "O quanto antes" disponível agora. */
  agora: boolean;
  /** AAAA-MM-DD de hoje em São Paulo (data do pedido "o quanto antes"). */
  hoje: string;
  /** Dias e faixas para agendar. */
  dias: DiaEntrega[];
  /** Instante real (ms) em que a loja fecha hoje, quando aberta. */
  fechaEm: number | null;
  /** Instante real (ms) da próxima abertura, quando fechada. */
  abreEm: number | null;
};

/** Chave do horário "o quanto antes". As faixas agendadas usam "AAAA-MM-DD|id". */
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

  // Próximos dias de funcionamento com alguma faixa livre (hoje só as que começam com antecedência).
  const dias: DiaEntrega[] = [];
  // Procura até 8 semanas à frente (folga para qualquer valor razoável de diasParaAgendar).
  for (let off = 0; off < 56 && dias.length < A.diasParaAgendar; off++) {
    const d = somarDias(parede, off);
    if (!abertoNoDia(d.getUTCDay())) continue;
    const livres = janelas
      .filter((j) => teste || off > 0 || j.inicio - A.antecedenciaMin >= min)
      .map((j) => ({ ...j }));
    if (livres.length) dias.push({ data: isoData(d), diaSemana: d.getUTCDay(), janelas: livres });
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
    agora: teste || (aberta && min <= A.agoraAteMin),
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

/** Data (AAAA-MM-DD) do pedido para a escolha de horário: hoje, se for "o quanto antes". */
export const dataDoHorario = (agenda: Agenda | null, chave: string | null | undefined) =>
  chave === CHAVE_AGORA ? (agenda?.hoje ?? null) : (chave?.split("|")[0] ?? null);

const hora = (min: number) => `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`;

/** Textos do status: selo, contagem regressiva e frase. Usados na home e na etapa de entrega. */
export function textosAgenda(ag: Agenda, agora: number, A: (typeof loja)["agenda"] = loja.agenda) {
  if (ag.teste) {
    return { selo: "Modo teste", contagem: "", texto: "Pedidos liberados a qualquer hora (modo teste)." };
  }
  if (ag.modo === "aberta") {
    return {
      selo: "Aberto agora",
      contagem: `Fecha em ${contagem(ag.fechaEm! - agora)}.`,
      texto: ag.agora
        ? `Delivery até as ${hora(A.fechaMin)}. Peça para agora ou agende um horário.`
        : `Pedidos para agora vão até as ${hora(A.agoraAteMin)}. Agende o seu para o próximo dia.`,
    };
  }
  const abre = paredeSP(ag.abreEm!);
  const hojeMesmo = isoData(abre) === ag.hoje;
  const quando = hojeMesmo ? "hoje" : `${DIAS[abre.getUTCDay()]}, ${ddmm(abre)},`;
  return {
    selo: "Fechado agora",
    contagem: `Abre em ${contagem(ag.abreEm! - agora)}.`,
    texto: `Abrimos ${quando} às ${hora(A.abreMin)}. Você já pode fazer o pedido e agendar o horário.`,
  };
}

/** "Sábado, 24/10 · 14h às 15h" ou "O quanto antes (hoje, 18/10)". */
export function textoHorario(agenda: Agenda | null, chave: string | null | undefined): string {
  if (!chave) return "";
  if (chave === CHAVE_AGORA)
    return agenda ? `O quanto antes (hoje, ${ddmm(dataDeIso(agenda.hoje))})` : "O quanto antes";
  const [data, id] = chave.split("|");
  const j = loja.janelas.find((x) => x.id === id);
  if (!data || !j) return "";
  const d = dataDeIso(data);
  return `${DIAS[d.getUTCDay()].replace(/^./, (c) => c.toUpperCase())}, ${ddmm(d)} · ${j.nome}`;
}

/** "13h às 18h" (horário de funcionamento, para os textos do site). */
export const HORARIO_FUNCIONAMENTO = `${hora(loja.agenda.abreMin)} às ${hora(loja.agenda.fechaMin)}`;
