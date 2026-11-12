import { loja, type Janela } from "@/config/loja";

/**
 * Horário de funcionamento por dia da semana (admin → Horário). Um horário por dia, de 30 em 30 min.
 * Funções puras: valem no servidor e no navegador.
 */

/** Um dia: aberto ou não, e a hora de abrir e de fechar (minutos desde 0h, horário de São Paulo). */
export type HorarioDia = { aberto: boolean; abre: number; fecha: number };

/** Os 7 dias, na posição do dia da semana (0 = domingo … 6 = sábado). */
export type HorarioSemana = HorarioDia[];

/** Passo dos horários (minutos). */
export const PASSO_HORARIO = 30;
/** Horas que aparecem nos campos "Abre às" e "Fecha às": de 30 em 30 min, das 06h às 23h30. */
export const PRIMEIRA_HORA = 6 * 60;
export const ULTIMA_HORA = 23 * 60 + 30;
export const HORAS_DO_DIA = Array.from(
  { length: (ULTIMA_HORA - PRIMEIRA_HORA) / PASSO_HORARIO + 1 },
  (_, i) => PRIMEIRA_HORA + i * PASSO_HORARIO,
);
/** O fechamento precisa vir pelo menos isto depois da abertura (uma faixa de 1 hora). */
export const DURACAO_MINIMA = 60;
/** Duração de cada faixa para agendar. */
export const DURACAO_FAIXA = 60;

/** Ordem de exibição: segunda a domingo. */
export const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0] as const;

export const NOMES_DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
const DIAS_MINUSCULOS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;
const DIAS_PLURAL = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"] as const;
const DIAS_CURTOS_MIN = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const SCHEMA_DIAS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** 780 → "13h"; 790 → "13h10". */
export const hora = (min: number) =>
  `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`;

/** Cópia do horário padrão de src/config/loja.ts (vale sem banco ou se a leitura falhar). */
export const horarioPadrao = (): HorarioSemana => loja.horarioPadrao.map((d) => ({ ...d }));

const minutoValido = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v % PASSO_HORARIO === 0 && v >= 0 && v <= 24 * 60;

/** O dia aberto tem um horário que dá pelo menos uma faixa? */
export const diaValido = (d: HorarioDia) =>
  !d.aberto || (d.abre >= PRIMEIRA_HORA && d.fecha <= ULTIMA_HORA && d.fecha >= d.abre + DURACAO_MINIMA);

/**
 * Lê um horário vindo de fora (banco, /api/loja). Devolve null se não for um horário válido:
 * 7 dias, minutos inteiros de 30 em 30 e, nos dias abertos, fechamento ≥ abertura + 1h.
 */
export function lerHorarioSemana(v: unknown): HorarioSemana | null {
  if (!Array.isArray(v) || v.length !== 7) return null;
  const semana: HorarioSemana = [];
  for (const d of v) {
    if (!d || typeof d !== "object") return null;
    const { aberto, abre, fecha } = d as Record<string, unknown>;
    if (typeof aberto !== "boolean" || !minutoValido(abre) || !minutoValido(fecha)) return null;
    const dia = { aberto, abre, fecha };
    if (!diaValido(dia)) return null;
    semana.push(dia);
  }
  return semana;
}

export type ErroHorario = { dia: number; campo: "abre" | "fecha"; mensagem: string };

/**
 * Validação do formulário do admin (no navegador e de novo no servidor). Só os dias abertos precisam de
 * horário válido; nos fechados, as horas ficam guardadas como estão (se forem inválidas, voltam ao padrão).
 */
export function validarHorario(
  v: unknown,
): { ok: true; horario: HorarioSemana } | { ok: false; erros: ErroHorario[] } {
  if (!Array.isArray(v) || v.length !== 7)
    return { ok: false, erros: [{ dia: 1, campo: "abre", mensagem: "Horário inválido." }] };
  const padrao = horarioPadrao();
  const erros: ErroHorario[] = [];
  const horario: HorarioSemana = [];
  v.forEach((d: unknown, dia) => {
    const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
    const aberto = o.aberto === true;
    const nome = NOMES_DIAS[dia];
    if (typeof o.aberto !== "boolean") {
      erros.push({ dia, campo: "abre", mensagem: `${nome}: horário inválido.` });
      horario.push(padrao[dia]);
      return;
    }
    const naLista = (x: unknown): x is number => typeof x === "number" && HORAS_DO_DIA.includes(x);
    if (!aberto) {
      const guardar = naLista(o.abre) && naLista(o.fecha);
      horario.push({
        aberto: false,
        abre: guardar ? (o.abre as number) : padrao[dia].abre,
        fecha: guardar ? (o.fecha as number) : padrao[dia].fecha,
      });
      return;
    }
    if (!naLista(o.abre)) {
      erros.push({ dia, campo: "abre", mensagem: `${nome}: escolha a hora de abrir (entre 6h e 23h30).` });
    }
    if (!naLista(o.fecha)) {
      erros.push({
        dia,
        campo: "fecha",
        mensagem: `${nome}: escolha a hora de fechar (até 23h30; não vale fechar depois da meia-noite).`,
      });
    } else if (naLista(o.abre) && o.fecha < o.abre + DURACAO_MINIMA) {
      erros.push({
        dia,
        campo: "fecha",
        mensagem: `${nome}: o fechamento precisa ser pelo menos 1 hora depois da abertura.`,
      });
    }
    horario.push({ aberto: true, abre: o.abre as number, fecha: o.fecha as number });
  });
  return erros.length ? { ok: false, erros } : { ok: true, horario };
}

/** Faixas de 1 hora para agendar num dia, dentro do horário dele: 13h–18h → 13h, 14h, 15h, 16h e 17h. */
export function faixasDoDia(d: HorarioDia | undefined): Janela[] {
  if (!d?.aberto) return [];
  const faixas: Janela[] = [];
  for (let inicio = d.abre; inicio + DURACAO_FAIXA <= d.fecha; inicio += DURACAO_FAIXA) {
    const fim = inicio + DURACAO_FAIXA;
    faixas.push({ id: hora(inicio), inicio, fim, nome: `${hora(inicio)} às ${hora(fim)}` });
  }
  return faixas;
}

/** Faixa a partir do id ("13h", "13h30"), para mostrar pedidos já feitos. Null se não for um id de faixa. */
export function faixaDeId(id: string | null | undefined): Janela | null {
  const m = /^(\d{1,2})h(\d{2})?$/.exec(id ?? "");
  if (!m) return null;
  const inicio = Number(m[1]) * 60 + Number(m[2] ?? 0);
  if (inicio >= 24 * 60 || Number(m[2] ?? 0) >= 60) return null;
  const fim = inicio + DURACAO_FAIXA;
  return { id: id!, inicio, fim, nome: `${hora(inicio)} às ${hora(fim)}` };
}

/** Dias abertos, na ordem de segunda a domingo. */
export const diasAbertos = (h: HorarioSemana) => ORDEM_SEMANA.filter((d) => h[d]?.aberto);

/** Dias com o mesmo horário juntos (ordem de segunda a domingo). */
export function gruposHorario(h: HorarioSemana): { dias: number[]; abre: number; fecha: number }[] {
  const grupos: { dias: number[]; abre: number; fecha: number }[] = [];
  for (const d of diasAbertos(h)) {
    const g = grupos.find((x) => x.abre === h[d].abre && x.fecha === h[d].fecha);
    if (g) g.dias.push(d);
    else grupos.push({ dias: [d], abre: h[d].abre, fecha: h[d].fecha });
  }
  return grupos;
}

const juntar = (itens: string[]) =>
  itens.length <= 1 ? (itens[0] ?? "") : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;

/** Os dias seguidos (3 ou mais) viram "de segunda a sexta". */
function blocos(dias: number[]): number[][] {
  const pos = (d: number) => ORDEM_SEMANA.indexOf(d as (typeof ORDEM_SEMANA)[number]);
  const res: number[][] = [];
  for (const d of dias) {
    const ultimo = res.at(-1);
    if (ultimo && pos(d) === pos(ultimo.at(-1)!) + 1) ultimo.push(d);
    else res.push([d]);
  }
  return res;
}

/**
 * "sábado e domingo", "de segunda a sexta" ou, no plural, "aos sábados e domingos", "às segundas e quartas".
 */
export function textoDias(dias: number[], plural = false): string {
  const partes: string[] = [];
  let artigoAnterior = "";
  for (const b of blocos(dias)) {
    if (b.length >= 3) {
      partes.push(`de ${DIAS_MINUSCULOS[b[0]]} a ${DIAS_MINUSCULOS[b.at(-1)!]}`);
      artigoAnterior = "";
      continue;
    }
    for (const d of b) {
      if (!plural) {
        partes.push(DIAS_MINUSCULOS[d]);
        continue;
      }
      const artigo = d === 0 || d === 6 ? "aos" : "às";
      partes.push(artigo === artigoAnterior ? DIAS_PLURAL[d] : `${artigo} ${DIAS_PLURAL[d]}`);
      artigoAnterior = artigo;
    }
  }
  return juntar(partes);
}

/** "13h às 18h" */
export const textoHoras = (abre: number, fecha: number) => `${hora(abre)} às ${hora(fecha)}`;

/**
 * Horário da semana em texto, para o site e o admin:
 * "sábado e domingo, das 13h às 18h" ou "de segunda a sexta, das 10h às 18h, e sábado, das 13h às 18h".
 * Com `plural`: "aos sábados e domingos, das 13h às 18h". Sem nenhum dia aberto: "".
 */
export function textoFuncionamento(h: HorarioSemana, plural = false): string {
  const partes = gruposHorario(h).map(
    (g) => `${textoDias(g.dias, plural)}, das ${textoHoras(g.abre, g.fecha)}`,
  );
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join("; ")}, e ${partes.at(-1)}`;
}

/** "Sáb e dom", "Seg a sex, sáb e dom" (dias abertos, curto). */
export function textoDiasCurto(h: HorarioSemana): string {
  const partes = blocos(diasAbertos(h)).flatMap((b) =>
    b.length >= 3
      ? [`${DIAS_CURTOS_MIN[b[0]]} a ${DIAS_CURTOS_MIN[b.at(-1)!]}`]
      : b.map((d) => DIAS_CURTOS_MIN[d]),
  );
  const t = juntar(partes);
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

/** "13h às 18h" se todos os dias abertos têm o mesmo horário; senão, "Varia por dia". */
export function textoHorasCurto(h: HorarioSemana): string {
  const g = gruposHorario(h);
  if (!g.length) return "";
  return g.length === 1 ? textoHoras(g[0].abre, g[0].fecha) : "Varia por dia";
}

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** openingHoursSpecification do JSON-LD (schema.org), um item por horário diferente. */
export const especificacaoHorario = (h: HorarioSemana) =>
  gruposHorario(h).map((g) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: g.dias.map((d) => `https://schema.org/${SCHEMA_DIAS[d]}`),
    opens: hhmm(g.abre),
    closes: hhmm(g.fecha),
  }));
