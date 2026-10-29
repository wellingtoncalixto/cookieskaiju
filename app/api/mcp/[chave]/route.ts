import { chaveConfere, leituraConfigurada } from "@/server/gpt";
import { servidorMcp } from "@/server/mcp";

/**
 * Servidor MCP para o ChatGPT (plugin em modo desenvolvedor), SOMENTE LEITURA.
 * Variante com a chave no endereço (/api/mcp/<GPT_API_CHAVE>), para clientes que não enviam cabeçalho.
 * Prefira /api/mcp com "Authorization: Bearer <GPT_API_CHAVE>".
 * As consultas usam o usuário gpt_leitura (só SELECT), em transação somente leitura, com até 500 linhas.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Contexto = { params: Promise<{ chave: string }> };

async function atender(request: Request, { params }: Contexto) {
  const { chave } = await params;
  if (!leituraConfigurada() || !chaveConfere(chave)) return new Response("Not Found", { status: 404 });
  return servidorMcp(request);
}

export { atender as GET, atender as POST, atender as DELETE };
