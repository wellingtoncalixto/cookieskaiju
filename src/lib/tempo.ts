import { loja } from "@/config/loja";

/**
 * Datas "de parede" em São Paulo.
 *
 * Para fazer contas de calendário sem depender do fuso do aparelho, representamos o
 * horário de São Paulo como um `Date` cujos campos UTC (getUTCDay, getUTCHours…) são
 * os de São Paulo. Esses objetos são chamados de "parede" e nunca devem ser exibidos
 * com métodos locais. Para converter de volta para um instante real, use `instanteDaParede`.
 */

const partesSP = new Intl.DateTimeFormat("en-US", {
  timeZone: loja.fuso,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Converte um instante real no horário de parede de São Paulo. */
export function paredeSP(instante: Date | number): Date {
  const partes = partesSP.formatToParts(new Date(instante));
  const g = (t: Intl.DateTimeFormatPartTypes) => Number(partes.find((p) => p.type === t)!.value);
  return new Date(Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second")));
}

/** Horário de parede atual em São Paulo. */
export const agoraSaoPaulo = () => paredeSP(Date.now());

/** Converte um horário de parede de São Paulo de volta para um instante real (ms). */
export function instanteDaParede(parede: Date): number {
  // Começa supondo a diferença atual e corrige (cobre eventuais mudanças de fuso).
  let palpite = parede.getTime() + 3 * 3600_000;
  for (let i = 0; i < 2; i++) {
    const diff = paredeSP(palpite).getTime() - parede.getTime();
    if (diff === 0) break;
    palpite -= diff;
  }
  return palpite;
}

const DIA_MS = 86_400_000;
export const inicioDoDia = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
export const somarDias = (d: Date, n: number) => new Date(inicioDoDia(d) + n * DIA_MS);
export const minutosDoDia = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();

const pad = (n: number) => String(n).padStart(2, "0");

/** AAAA-MM-DD de uma data de parede. */
export const isoData = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** DD/MM de uma data de parede. */
export const ddmm = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;

/** Lê AAAA-MM-DD como data de parede. */
export function dataDeIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;
export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const capitalizar = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

/** "Sábado, 17/10" */
export const diaPorExtenso = (d: Date) => `${capitalizar(DIAS[d.getUTCDay()])}, ${ddmm(d)}`;

/** Contagem regressiva curta: "1d 2h 00min", "3h 05min", "12min". */
export function contagem(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d) return `${d}d ${h}h ${pad(mm)}min`;
  if (h) return `${h}h ${pad(mm)}min`;
  return `${mm}min`;
}
