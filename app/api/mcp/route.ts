import { autorizado, leituraConfigurada } from "@/server/gpt";
import { servidorMcp } from "@/server/mcp";

/**
 * Servidor MCP para o ChatGPT (plugin), SOMENTE LEITURA, com a chave no cabeçalho
 * "Authorization: Bearer <GPT_API_CHAVE>". As consultas usam o usuário gpt_leitura (só SELECT),
 * em transação somente leitura, com até 500 linhas.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function atender(request: Request) {
  if (!leituraConfigurada()) return Response.json({ erro: "não configurado" }, { status: 503 });
  if (!autorizado(request))
    return Response.json(
      { erro: "não autorizado" },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="cookies-kaiju"' } },
    );
  return servidorMcp(request);
}

export { atender as GET, atender as POST, atender as DELETE };
