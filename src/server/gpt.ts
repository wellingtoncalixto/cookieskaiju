import "server-only";
import { timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

/**
 * Acesso do ChatGPT (GPT personalizado com Actions) ao banco, SÓ DE LEITURA, em três camadas:
 * 1. a conexão usa DATABASE_URL_LEITURA, de um usuário do Postgres que só tem SELECT;
 * 2. cada consulta roda numa transação READ ONLY, com tempo máximo de 10 s;
 * 3. no máximo 500 linhas por resposta.
 * A chamada precisa do cabeçalho Authorization: Bearer GPT_API_CHAVE.
 */
export const LIMITE_LINHAS = 500;

export function autorizado(request: Request) {
  const chave = process.env.GPT_API_CHAVE;
  const enviada = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!chave || chave.length < 24) return false;
  const a = Buffer.from(enviada);
  const b = Buffer.from(chave);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const leituraConfigurada = () =>
  Boolean(process.env.DATABASE_URL_LEITURA && process.env.GPT_API_CHAVE);

export async function consultarSomenteLeitura(texto: string, parametros: unknown[] = []) {
  const sql = neon(process.env.DATABASE_URL_LEITURA!);
  const [, linhas] = await sql.transaction(
    (tx) => [tx.query("set local statement_timeout = '10s'"), tx.query(texto, parametros)],
    { readOnly: true },
  );
  return linhas as Record<string, unknown>[];
}

/** Uma única instrução SELECT/WITH, sem ponto e vírgula no meio (o resto o banco já impede). */
export function sqlAceito(sql: string): string | null {
  const limpo = sql.trim().replace(/;\s*$/, "");
  if (!limpo || limpo.length > 8000 || limpo.includes(";")) return null;
  if (!/^(select|with)\b/i.test(limpo)) return null;
  return limpo;
}
