import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Assinaturas HMAC-SHA256 usadas só no servidor.
 * - Cotação de frete: /api/frete devolve o valor assinado; /api/pedidos só aceita frete com assinatura válida.
 * - Envelope para o Apps Script: o mesmo algoritmo está em apps-script/Nucleo.gs (validarEnvelope).
 */

export const hmacHex = (mensagem: string, segredo: string) =>
  createHmac("sha256", segredo).update(mensagem, "utf8").digest("hex");

function iguais(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// ---------- cotação de frete ----------
export type Cotacao = { cep: string; km1Decimal: number; kmCobrado: number; valor: number; exp: number };

const COTACAO_VALIDADE_MS = 3 * 3600_000;

export function assinarCotacao(c: Omit<Cotacao, "exp">, segredo: string, agora = Date.now()): string {
  const dados = Buffer.from(JSON.stringify({ ...c, exp: agora + COTACAO_VALIDADE_MS })).toString("base64url");
  return `${dados}.${hmacHex(dados, segredo)}`;
}

/** Devolve a cotação se a assinatura confere e não venceu; senão, `null`. */
export function lerCotacao(token: unknown, segredo: string, agora = Date.now()): Cotacao | null {
  if (typeof token !== "string" || token.length > 600) return null;
  const [dados, assinatura] = token.split(".");
  if (!dados || !assinatura || !iguais(assinatura, hmacHex(dados, segredo))) return null;
  try {
    const c = JSON.parse(Buffer.from(dados, "base64url").toString("utf8")) as Cotacao;
    if (typeof c.exp !== "number" || c.exp < agora) return null;
    if (
      ![c.km1Decimal, c.kmCobrado, c.valor].every(
        (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
      )
    )
      return null;
    return c;
  } catch {
    return null;
  }
}

// ---------- envelope para o Apps Script ----------
export type Envelope = { versao: 1; ts: number; nonce: string; corpo: string; assinatura: string };

/** Assina `${ts}.${nonce}.${corpo}`. O Apps Script recusa assinatura inválida, ts fora de ±5 min e nonce repetido. */
export function montarEnvelope(corpo: unknown, segredo: string, agora = Date.now()): Envelope {
  const json = JSON.stringify(corpo);
  const nonce = randomBytes(12).toString("hex");
  return {
    versao: 1,
    ts: agora,
    nonce,
    corpo: json,
    assinatura: hmacHex(`${agora}.${nonce}.${json}`, segredo),
  };
}
