import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { chaveConfere, consultaDoChatGpt, esquemaBanco, leituraConfigurada } from "@/server/gpt";

/**
 * Servidor MCP para o ChatGPT (plugin em modo desenvolvedor), SOMENTE LEITURA.
 * O ChatGPT só aceita "sem autenticação" ou OAuth; aqui a chave fica no próprio endereço
 * (/api/mcp/<GPT_API_CHAVE>): quem não tem o endereço completo recebe 404.
 * As consultas usam o usuário gpt_leitura (só SELECT), em transação somente leitura, com até 500 linhas.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const INSTRUCOES = `Dados da Cookies Kaiju (cookies artesanais em Mogi Mirim/SP). Somente leitura.
Chame ver_esquema antes da primeira consulta. Use consultar com SQL do PostgreSQL (uma única instrução SELECT ou WITH).
Vendas consideram pedidos com status = 'concluido'. Pedidos são identificados por numero (#numero).
Valores em reais. Datas de venda: entrega_data; criado_em está em UTC (use a view vw_pedidos para o horário de São Paulo).`;

const json = (dados: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(dados) }],
  structuredContent: dados as Record<string, unknown>,
});

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "ver_esquema",
      {
        title: "Ver tabelas e colunas",
        description:
          "Lista as tabelas e views do banco da Cookies Kaiju com colunas e descrições (pedidos, itens, produtos, precificação, estoque, despesas, metas e o painel). Chame antes de montar consultas.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async () => json(await esquemaBanco()),
    );
    server.registerTool(
      "consultar",
      {
        title: "Consultar dados (SQL)",
        description:
          "Executa uma consulta SQL do PostgreSQL (uma única instrução SELECT ou WITH ... SELECT) no banco da Cookies Kaiju e devolve até 500 linhas. Somente leitura.",
        inputSchema: z.object({ sql: z.string().describe("Uma única instrução SELECT ou WITH ... SELECT.") }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ sql }) => {
        const r = await consultaDoChatGpt(sql);
        return { ...json(r), isError: "erro" in r };
      },
    );
  },
  { serverInfo: { name: "cookies-kaiju-dados", version: "1.0.0" }, instructions: INSTRUCOES },
);

type Contexto = { params: Promise<{ chave: string }> };

async function atender(request: Request, { params }: Contexto) {
  const { chave } = await params;
  if (!leituraConfigurada() || !chaveConfere(chave)) return new Response("Not Found", { status: 404 });
  return handler(request);
}

export { atender as GET, atender as POST, atender as DELETE };
