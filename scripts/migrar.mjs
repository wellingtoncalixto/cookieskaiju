// Aplica as migrações de db/migracoes/ (em ordem, uma vez cada) no banco de DATABASE_URL.
// Uso: DATABASE_URL=... node scripts/migrar.mjs [arquivo-extra.sql]
// O arquivo extra (ex.: db/dados-iniciais.local.sql) roda depois das migrações, só se ainda não rodou.
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL (Vercel → Storage → Neon → .env.local).");
  process.exit(1);
}

const pasta = join(import.meta.dirname, "..", "db", "migracoes");
const arquivos = readdirSync(pasta)
  .filter((a) => a.endsWith(".sql"))
  .sort()
  .map((a) => join(pasta, a));
if (process.argv[2]) arquivos.push(process.argv[2]);

const pool = new Pool({ connectionString: url });
const cliente = await pool.connect();
try {
  await cliente.query(
    "create table if not exists _migracoes (nome text primary key, aplicada_em timestamptz not null default now())",
  );
  const { rows } = await cliente.query("select nome from _migracoes");
  const aplicadas = new Set(rows.map((r) => r.nome));
  for (const arquivo of arquivos) {
    const nome = basename(arquivo);
    if (aplicadas.has(nome)) continue;
    await cliente.query("begin");
    try {
      await cliente.query(readFileSync(arquivo, "utf8"));
      await cliente.query("insert into _migracoes (nome) values ($1)", [nome]);
      await cliente.query("commit");
      console.log(`aplicada: ${nome}`);
    } catch (erro) {
      await cliente.query("rollback");
      console.error(`falhou: ${nome}\n${erro.message}`);
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) console.log("banco atualizado.");
} finally {
  cliente.release();
  await pool.end();
}
