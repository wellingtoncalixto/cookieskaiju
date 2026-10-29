import "server-only";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { SITE_URL } from "@/config/loja";
import { consultaDoChatGpt, esquemaBanco } from "@/server/gpt";
import { registrarNotaDoChatGpt } from "@/server/notas";

/**
 * Servidor MCP do ChatGPT: ver_esquema e consultar (somente leitura) e registrar_nota_compra, que só cria um
 * RASCUNHO de nota de compra para o admin conferir e aplicar.
 */
const INSTRUCOES = `Dados da Cookies Kaiju (cookies artesanais em Mogi Mirim/SP).
Chame ver_esquema antes da primeira consulta. Use consultar com SQL do PostgreSQL (uma única instrução SELECT ou WITH).
Vendas consideram pedidos com status = 'concluido'. Pedidos são identificados por numero (#numero).
Valores em reais. Datas de venda: entrega_data; criado_em está em UTC (use a view vw_pedidos para o horário de São Paulo).
Notas e cupons fiscais de compra: leia a imagem/PDF, consulte os insumos (select id, nome, unidade from insumos), mostre ao usuário
a lista de itens com quantidade, embalagem e valor e o insumo sugerido, e só depois da confirmação chame registrar_nota_compra.
A nota fica como rascunho: o usuário confere e aplica no admin (Compras).`;

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
    server.registerTool(
      "registrar_nota_compra",
      {
        title: "Registrar nota de compra (rascunho)",
        description:
          "Registra uma nota fiscal ou cupom de COMPRA da loja (ingredientes, embalagens) como RASCUNHO, para o dono conferir e aplicar no admin. Não altera preços nem lança despesas sozinho. Antes de chamar, mostre os itens lidos ao usuário e peça confirmação. Para cada item: quantidade = quantas embalagens; tamanho_embalagem + unidade = conteúdo de UMA embalagem em g, ml ou un (ex.: 2 manteigas de 500 g = quantidade 2, 500 g; produto pesado 0,535 kg = quantidade 1, 535 g); valor_total = valor pago pela linha, já com desconto; insumo_id = id do insumo cadastrado que é claramente o mesmo produto, ou null.",
        inputSchema: z.object({
          fornecedor: z.string().max(120).describe("Nome da loja/emitente."),
          data: z.string().nullable().describe("Data da compra em AAAA-MM-DD, ou null."),
          total: z.number().nullable().describe("Total pago na nota, ou null."),
          observacao: z.string().max(300).describe("Algo ilegível ou duvidoso; string vazia se nada."),
          itens: z
            .array(
              z.object({
                descricao: z.string().max(160),
                quantidade: z.number(),
                tamanho_embalagem: z.number().nullable(),
                unidade: z.enum(["g", "ml", "un"]).nullable(),
                valor_total: z.number(),
                insumo_id: z.number().int().nullable(),
              }),
            )
            .min(1)
            .max(100),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async (nota) => {
        const r = await registrarNotaDoChatGpt({ ...nota, legivel: true });
        if ("erro" in r) return { ...json(r), isError: true };
        return json({
          ...r,
          situacao: "rascunho",
          conferir_em: `${SITE_URL}/admin/compras/${r.id}`,
          aviso: "Nada foi aplicado ainda: confira e toque em Aplicar nota no admin.",
        });
      },
    );
  },
  { serverInfo: { name: "cookies-kaiju-dados", version: "1.0.0" }, instructions: INSTRUCOES },
);
