import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Banco } from "@/server/db";

/** Postgres em memória (PGlite) com todas as migrações de db/migracoes aplicadas. */
export async function bancoDeTeste(): Promise<Banco & { pg: PGlite }> {
  const pg = new PGlite();
  const pasta = join(process.cwd(), "db", "migracoes");
  for (const arquivo of readdirSync(pasta)
    .filter((a) => a.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync(join(pasta, arquivo), "utf8"));
  return {
    pg,
    consulta: async <T>(texto: string, parametros: unknown[] = []) =>
      (await pg.query<T>(texto, parametros)).rows,
  };
}
