import {
  LIMITE_LINHAS,
  autorizado,
  consultarSomenteLeitura,
  leituraConfigurada,
  sqlAceito,
} from "@/server/gpt";

export const dynamic = "force-dynamic";

/** Executa um SELECT (somente leitura) para o ChatGPT. Corpo: { "sql": "select ..." }. */
export async function POST(request: Request) {
  if (!leituraConfigurada())
    return Response.json({ erro: "acesso do ChatGPT não configurado" }, { status: 503 });
  if (!autorizado(request)) return Response.json({ erro: "não autorizado" }, { status: 401 });
  let sql: unknown;
  try {
    sql = ((await request.json()) as { sql?: unknown }).sql;
  } catch {
    return Response.json({ erro: 'envie JSON: { "sql": "select ..." }' }, { status: 400 });
  }
  const aceito = typeof sql === "string" ? sqlAceito(sql) : null;
  if (!aceito)
    return Response.json({ erro: "envie uma única consulta SELECT (ou WITH ... SELECT)" }, { status: 400 });
  try {
    const linhas = await consultarSomenteLeitura(
      `select * from (${aceito}) as consulta limit ${LIMITE_LINHAS + 1}`,
    );
    return Response.json({
      linhas: linhas.slice(0, LIMITE_LINHAS),
      total: Math.min(linhas.length, LIMITE_LINHAS),
      cortado: linhas.length > LIMITE_LINHAS,
    });
  } catch (erro) {
    // A mensagem do Postgres (ex.: coluna inexistente) ajuda o ChatGPT a corrigir a consulta.
    return Response.json(
      { erro: erro instanceof Error ? erro.message : "falha na consulta" },
      { status: 400 },
    );
  }
}
