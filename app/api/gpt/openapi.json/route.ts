import { SITE_URL } from "@/config/loja";

/** Esquema OpenAPI para importar nas Actions do GPT personalizado (autenticação: API Key, tipo Bearer). */
export function GET() {
  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "Cookies Kaiju — dados da loja (somente leitura)",
      version: "1.0.0",
      description:
        "Consulta o banco da Cookies Kaiju: pedidos, itens, produtos, precificação, estoque, campanhas, metas e views do painel. Somente leitura.",
    },
    servers: [{ url: SITE_URL }],
    paths: {
      "/api/gpt/esquema": {
        get: {
          operationId: "lerEsquema",
          summary: "Lista tabelas, views e colunas (com descrições). Chame antes de montar consultas.",
          responses: { "200": { description: "Esquema do banco" } },
        },
      },
      "/api/gpt/consulta": {
        post: {
          operationId: "consultar",
          summary: "Executa uma consulta SQL SELECT (PostgreSQL) e devolve até 500 linhas.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["sql"],
                  properties: {
                    sql: { type: "string", description: "Uma única instrução SELECT ou WITH ... SELECT." },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Linhas do resultado" },
            "400": { description: "Erro na consulta" },
          },
        },
      },
    },
    components: { securitySchemes: { chave: { type: "http", scheme: "bearer" } } },
    security: [{ chave: [] }],
  });
}
