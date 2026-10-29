import { autorizado, consultaDoChatGpt, leituraConfigurada } from "@/server/gpt";

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
  const r = await consultaDoChatGpt(typeof sql === "string" ? sql : "");
  return Response.json(r, { status: "erro" in r ? 400 : 200 });
}
