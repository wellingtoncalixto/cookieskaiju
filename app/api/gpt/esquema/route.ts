import { autorizado, consultarSomenteLeitura, leituraConfigurada } from "@/server/gpt";

export const dynamic = "force-dynamic";

/** Tabelas, views, colunas e comentários do banco, para o ChatGPT montar as consultas. */
export async function GET(request: Request) {
  if (!leituraConfigurada())
    return Response.json({ erro: "acesso do ChatGPT não configurado" }, { status: 503 });
  if (!autorizado(request)) return Response.json({ erro: "não autorizado" }, { status: 401 });
  const linhas = await consultarSomenteLeitura(
    `select c.relname as tabela,
            case c.relkind when 'v' then 'view' else 'tabela' end as tipo,
            obj_description(c.oid, 'pg_class') as descricao,
            json_agg(json_build_object(
              'coluna', a.attname,
              'tipo', format_type(a.atttypid, a.atttypmod),
              'descricao', col_description(c.oid, a.attnum)
            ) order by a.attnum) as colunas
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
       join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      where c.relkind in ('r', 'v') and left(c.relname, 1) <> '_'
      group by c.oid, c.relname, c.relkind
      order by c.relkind, c.relname`,
  );
  return Response.json({
    observacoes: [
      "Valores em reais (BRL). Instantes em UTC: use criado_em at time zone 'America/Sao_Paulo' (ou a view vw_pedidos).",
      "Não há dados pessoais de clientes no banco.",
      "Métricas de venda normalmente consideram só pedidos com status = 'concluido'.",
    ],
    tabelas: linhas,
  });
}
