import "server-only";
import { montarEnvelope } from "@/lib/assinatura";
import type { CorpoPlanilha } from "@/lib/registro-pedido";

/**
 * Envia o pedido ao Apps Script da planilha.
 * A URL e o segredo ficam só nas variáveis de ambiente do servidor (APPS_SCRIPT_URL, APPS_SCRIPT_SEGREDO).
 */
export type RespostaPlanilha =
  { ok: true; duplicado: boolean; avisos: string[] } | { ok: false; erro: string; definitivo: boolean };

const TIMEOUT_MS = 15_000;

/** Erros do script que não adianta repetir (o pedido em si é inválido para a planilha). */
const ERROS_DEFINITIVOS = new Set(["corpo_invalido", "id_invalido", "sem_itens"]);

export async function enviarAoAppsScript(corpo: CorpoPlanilha): Promise<RespostaPlanilha> {
  const url = process.env.APPS_SCRIPT_URL;
  const segredo = process.env.APPS_SCRIPT_SEGREDO;
  if (!url || !segredo) return { ok: false, erro: "configuracao_ausente", definitivo: true };

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let resposta: Response;
  try {
    // O Apps Script responde por um redirecionamento (302) para googleusercontent.com: seguimos.
    resposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(montarEnvelope(corpo, segredo)),
      redirect: "follow",
      signal: ctl.signal,
      cache: "no-store",
    });
  } catch {
    return { ok: false, erro: ctl.signal.aborted ? "tempo_esgotado" : "falha_de_rede", definitivo: false };
  } finally {
    clearTimeout(t);
  }

  if (!resposta.ok) return { ok: false, erro: `http_${resposta.status}`, definitivo: false };
  // Em falhas, o Apps Script às vezes devolve uma página HTML: só aceitamos JSON com ok: true.
  let j: { ok?: unknown; duplicado?: unknown; avisos?: unknown; erro?: unknown };
  try {
    j = await resposta.json();
  } catch {
    return { ok: false, erro: "resposta_invalida", definitivo: false };
  }
  if (j.ok === true) {
    return {
      ok: true,
      duplicado: j.duplicado === true,
      avisos: Array.isArray(j.avisos) ? j.avisos.filter((a): a is string => typeof a === "string") : [],
    };
  }
  const erro = typeof j.erro === "string" ? j.erro : "erro_desconhecido";
  return { ok: false, erro, definitivo: ERROS_DEFINITIVOS.has(erro) };
}
