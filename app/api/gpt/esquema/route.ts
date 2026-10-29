import { autorizado, esquemaBanco, leituraConfigurada } from "@/server/gpt";

export const dynamic = "force-dynamic";

/** Tabelas, views, colunas e comentários do banco, para o ChatGPT montar as consultas. */
export async function GET(request: Request) {
  if (!leituraConfigurada())
    return Response.json({ erro: "acesso do ChatGPT não configurado" }, { status: 503 });
  if (!autorizado(request)) return Response.json({ erro: "não autorizado" }, { status: 401 });
  return Response.json(await esquemaBanco());
}
