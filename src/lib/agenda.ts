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

export type ModoAgenda = "aberta" | "estoque" | "fechada";

export type DiaEntrega = {
  /** AAAA-MM-DD (data em São Paulo). */
  data: string;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  /** Janelas disponíveis neste dia. */
  janelas: Janela[];
};

export type Agenda = {
  modo: ModoAgenda;
  teste: boolean;
  dias: DiaEntrega[];
  /** Instante real (ms) em que a agenda aberta fecha. */
  fechaEm: number | null;
  /** Instante real (ms) em que algo volta a abrir, quando fechada. */
  abreEm: number | null;
  /** O que abre em `abreEm`: a pronta-entrega do fim de semana ou a agenda de quarta. */
  proxima: "estoque" | "agenda" | null;
};

type Opcoes = {
  modoTeste?: boolean;
  config?: Pick<typeof loja, "agenda" | "janelas">;
};

/**
 * Calcula a situação da agenda num instante.
 * Todas as contas usam o horário de São Paulo, independente do fuso do aparelho.
 */
export function calcularAgenda(agora: Date | number, opcoes: Opcoes = {}): Agenda {
  const { agenda: A, janelas } = opcoes.config ?? loja;
  const parede = paredeSP(agora);
  const dow = parede.getUTCDay();
  const min = minutosDoDia(parede);
  const todas = () => janelas.map((j) => ({ ...j }));
  const dia = (offset: number, js: Janela[]): DiaEntrega => {
    const d = somarDias(parede, offset);
    return { data: isoData(d), diaSemana: d.getUTCDay(), janelas: js };
  };
  const em = (offsetDias: number, minuto: number) =>
    instanteDaParede(new Date(inicioDoDia(parede) + offsetDias * 86_400_000 + minuto * 60_000));
  const base = { teste: false, fechaEm: null, abreEm: null, proxima: null } as const;

  // Próximo sábado (hoje, se já for sábado) e o domingo seguinte.
  const offSabado = (6 - dow + 7) % 7;

  if (opcoes.modoTeste) {
    return {
      ...base,
      modo: "aberta",
      teste: true,
      dias: [dia(offSabado, todas()), dia(offSabado + 1, todas())],
    };
  }

  const aberta =
    (dow === A.abreDia && min >= A.abreMin) ||
    (dow > A.abreDia && dow < A.fechaDia) ||
    (dow === A.fechaDia && min < A.fechaMin);

  if (aberta) {
    return {
      ...base,
      modo: "aberta",
      fechaEm: em(A.fechaDia - dow, A.fechaMin),
      dias: [dia(offSabado, todas()), dia(offSabado + 1, todas())],
    };
  }

  if (dow === 6 || dow === 0) {
    if (min < A.prontaEntregaDesdeMin) {
      return {
        ...base,
        modo: "fechada",
        abreEm: em(0, A.prontaEntregaDesdeMin),
        proxima: "estoque",
        dias: [],
      };
    }
    const dias = [
      dia(
        0,
        todas().filter((j) => j.inicio - A.antecedenciaMin >= min),
      ),
    ];
    if (dow === 6) dias.push(dia(1, todas()));
    const comJanelas = dias.filter((d) => d.janelas.length > 0);
    if (comJanelas.length) return { ...base, modo: "estoque", dias: comJanelas };
  }

  if (dow === A.fechaDia && min >= A.fechaMin) {
    return { ...base, modo: "fechada", abreEm: em(1, A.prontaEntregaDesdeMin), proxima: "estoque", dias: [] };
  }

  let off = (A.abreDia - dow + 7) % 7;
  if (off === 0 && min >= A.abreMin) off = 7;
  return { ...base, modo: "fechada", abreEm: em(off, A.abreMin), proxima: "agenda", dias: [] };
}

/** Chave estável de uma escolha de horário: "2026-10-17|noite". */
export const chaveHorario = (data: string, janelaId: string) => `${data}|${janelaId}`;

/** Confere se a chave de horário escolhida ainda é válida na agenda atual. */
export function horarioValido(agenda: Agenda, chave: string | null | undefined): boolean {
  if (!chave) return false;
  return agenda.dias.some((d) => d.janelas.some((j) => chaveHorario(d.data, j.id) === chave));
}

/** Textos do status: selo, contagem regressiva e frase. Usados na home e na etapa de entrega. */
export function textosAgenda(ag: Agenda, agora: number) {
  if (ag.teste) {
    const [a, b] = ag.dias.map((d) => dataDeIso(d.data));
    return {
      selo: "Modo teste",
      contagem: "Horários liberados.",
      texto: `Pedidos para ${DIAS[a.getUTCDay()]} ${ddmm(a)} e ${DIAS[b.getUTCDay()]} ${ddmm(b)}, a qualquer hora.`,
    };
  }
  if (ag.modo === "aberta") {
    const [a, b] = ag.dias.map((d) => dataDeIso(d.data));
    return {
      selo: "Agenda aberta",
      contagem: `Fecha em ${contagem(ag.fechaEm! - agora)}.`,
      texto: `Pedidos para sábado ${ddmm(a)} e domingo ${ddmm(b)}.`,
    };
  }
  if (ag.modo === "estoque") {
    return {
      selo: "Pronta-entrega",
      contagem: "",
      texto: "Entregamos neste fim de semana enquanto houver cookies no estoque.",
    };
  }
  const abre = paredeSP(ag.abreEm!);
  return {
    selo: "Agenda fechada",
    contagem: `Abre em ${contagem(ag.abreEm! - agora)}.`,
    texto:
      ag.proxima === "estoque"
        ? `Pronta-entrega volta ${DIAS[abre.getUTCDay()]} às ${abre.getUTCHours()}h, conforme estoque.`
        : `A próxima agenda abre ${DIAS[abre.getUTCDay()]}, ${ddmm(abre)}, às ${abre.getUTCHours()}h.`,
  };
}
