import "server-only";
import { neon } from "@neondatabase/serverless";

/**
 * Acesso ao Postgres (Neon). A conexão vem só de DATABASE_URL (criada pela integração Neon da Vercel).
 *
 * Convenções das consultas: o driver devolve `numeric` como texto e `date` com fuso. Por isso as consultas
 * convertem na própria SQL: valores com `::float8`, datas com `::text` e instantes com `epoch_ms(...)`.
 */
export type Banco = {
  consulta<T = Record<string, unknown>>(texto: string, parametros?: unknown[]): Promise<T[]>;
};

let banco: Banco | null = null;

export const bancoConfigurado = () => banco !== null || Boolean(process.env.DATABASE_URL);

export function obterBanco(): Banco {
  if (banco) return banco;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("banco: DATABASE_URL não configurada");
  if (url.startsWith("pglite:") && process.env.NODE_ENV !== "production") {
    banco = bancoLocal(url.slice("pglite:".length));
    return banco;
  }
  const sql = neon(url);
  banco = { consulta: (texto, parametros = []) => sql.query(texto, parametros) as never };
  return banco;
}

/**
 * Só em desenvolvimento: Postgres embutido (PGlite) numa pasta local, com as migrações e, se existir,
 * db/dados-iniciais.local.sql aplicados na primeira vez. Ex.: DATABASE_URL=pglite:.dados/dev
 * O pacote é carregado na hora (fora do bundle), para nunca ir para produção.
 */
function bancoLocal(pasta: string): Banco {
  // Uma instância por processo: no dev, rotas e páginas carregam cópias separadas deste módulo.
  const g = globalThis as {
    __ckPglite?: Promise<{ query: (t: string, p?: unknown[]) => Promise<{ rows: never[] }> }>;
  };
  g.__ckPglite ??= (async () => {
    const pacote = "@electric-sql/pglite";
    const { PGlite } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ pacote);
    const { readdirSync, readFileSync, existsSync, mkdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    mkdirSync(pasta, { recursive: true });
    const pg = new PGlite(pasta);
    const { rows } = await pg.query("select to_regclass('public.produtos') is not null as existe");
    if (!(rows[0] as { existe: boolean }).existe) {
      const dir = join(process.cwd(), "db", "migracoes");
      for (const a of readdirSync(dir)
        .filter((x: string) => x.endsWith(".sql"))
        .sort())
        await pg.exec(readFileSync(join(dir, a), "utf8"));
      const carga = join(process.cwd(), "db", "dados-iniciais.local.sql");
      if (existsSync(carga)) await pg.exec(readFileSync(carga, "utf8"));
    }
    return pg;
  })();
  const pronto = g.__ckPglite;
  // Se a abertura falhar, a próxima consulta tenta de novo.
  pronto.catch(() => {
    banco = null;
    g.__ckPglite = undefined;
  });
  return {
    consulta: async (texto, parametros = []) => (await (await pronto).query(texto, parametros)).rows,
  };
}

/** Só para testes: troca o banco (ex.: PGlite em memória). `null` volta ao padrão. */
export function usarBanco(b: Banco | null) {
  banco = b;
}

/** Instante (timestamptz) → milissegundos, como número. */
export const epochMs = (coluna: string) => `(extract(epoch from ${coluna}) * 1000)::float8`;
