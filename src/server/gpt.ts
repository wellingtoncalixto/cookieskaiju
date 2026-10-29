import "server-only";
import { timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

/**
 * Acesso do ChatGPT (GPT personalizado com Actions) ao banco, SÓ DE LEITURA, em três camadas:
 * 1. a conexão usa o usuário gpt_leitura do Postgres, que só tem SELECT (veja urlLeitura);
 * 2. cada consulta roda numa transação READ ONLY, com tempo máximo de 10 s;
 * 3. no máximo 500 linhas por resposta.
 * A chamada precisa do cabeçalho Authorization: Bearer GPT_API_CHAVE.
 */
export const LIMITE_LINHAS = 500;

export function autorizado(request: Request) {
  return chaveConfere(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
}

/**
 * URL do usuário só de leitura: DATABASE_URL_LEITURA, ou a DATABASE_URL do deploy com o usuário gpt_leitura e a
 * senha GPT_LEITURA_SENHA. A segunda forma acompanha o banco em uso (inclusive as branches de Preview do Neon,
 * que herdam os usuários do banco principal).
 */
function urlLeitura(): string | null {
  if (process.env.DATABASE_URL_LEITURA) return process.env.DATABASE_URL_LEITURA;
  const base = process.env.DATABASE_URL;
  const senha = process.env.GPT_LEITURA_SENHA;
  if (!base || !senha || base.startsWith("pglite:")) return null;
  const u = new URL(base);
  u.username = "gpt_leitura";
  u.password = senha;
  return u.toString();
}

export const leituraConfigurada = () => Boolean(urlLeitura() && process.env.GPT_API_CHAVE);

export async function consultarSomenteLeitura(texto: string, parametros: unknown[] = []) {
  const sql = neon(urlLeitura()!);
  const [, linhas] = await sql.transaction(
    (tx) => [tx.query("set local statement_timeout = '10s'"), tx.query(texto, parametros)],
    { readOnly: true },
  );
  return linhas as Record<string, unknown>[];
}

/** Uma única instrução SELECT/WITH, sem ponto e vírgula no meio (o resto o banco já impede). */
export function sqlAceito(sql: string): string | null {
  const limpo = sql.trim().replace(/;\s*$/, "");
  if (!limpo || limpo.length > 8000 || limpo.includes(";")) return null;
  if (!/^(select|with)\b/i.test(limpo)) return null;
  return limpo;
}

/** Tabelas, views, colunas e comentários do banco, para o ChatGPT montar as consultas. */
export async function esquemaBanco() {
  const tabelas = await consultarSomenteLeitura(
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
  return {
    observacoes: [
      "Valores em reais (BRL). Instantes em UTC: use criado_em at time zone 'America/Sao_Paulo' (ou a view vw_pedidos).",
      "Não há dados pessoais de clientes no banco.",
      "Métricas de venda normalmente consideram só pedidos com status = 'concluido'.",
      "Pedidos são identificados por numero (#numero); o id CK-… é interno. tipo_registro: site, manual ou historico.",
    ],
    tabelas,
  };
}

/** Executa um SELECT do ChatGPT (somente leitura, até LIMITE_LINHAS linhas). */
export async function consultaDoChatGpt(sql: string) {
  const aceito = sqlAceito(sql);
  if (!aceito) return { erro: "envie uma única consulta SELECT (ou WITH ... SELECT)" } as const;
  try {
    const linhas = await consultarSomenteLeitura(
      `select * from (${aceito}) as consulta limit ${LIMITE_LINHAS + 1}`,
    );
    return {
      linhas: linhas.slice(0, LIMITE_LINHAS),
      total: Math.min(linhas.length, LIMITE_LINHAS),
      cortado: linhas.length > LIMITE_LINHAS,
    } as const;
  } catch (erro) {
    // A mensagem do Postgres (ex.: coluna inexistente) ajuda o ChatGPT a corrigir a consulta.
    return { erro: erro instanceof Error ? erro.message : "falha na consulta" } as const;
  }
}

/** A chave do ChatGPT confere (comparação em tempo constante; chave configurada com 24+ caracteres)? */
export function chaveConfere(enviada: string) {
  const chave = process.env.GPT_API_CHAVE;
  if (!chave || chave.length < 24) return false;
  const a = Buffer.from(enviada);
  const b = Buffer.from(chave);
  return a.length === b.length && timingSafeEqual(a, b);
}
