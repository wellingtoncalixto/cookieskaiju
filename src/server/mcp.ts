import "server-only";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { consultaDoChatGpt, esquemaBanco } from "@/server/gpt";

/** Servidor MCP somente leitura do ChatGPT (ferramentas ver_esquema e consultar). */
const INSTRUCOES = `Dados da Cookies Kaiju (cookies artesanais em Mogi Mirim/SP). Somente leitura.
Chame ver_esquema antes da primeira consulta. Use consultar com SQL do PostgreSQL (uma única instrução SELECT ou WITH).
Vendas consideram pedidos com status = 'concluido'. Pedidos são identificados por numero (#numero).
Valores em reais. Datas de venda: entrega_data; criado_em está em UTC (use a view vw_pedidos para o horário de São Paulo).`;

const json = (dados: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(dados) }],
  structuredContent: dados as Record<string, unknown>,
});

export const servidorMcp = createMcpHandler(
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
