import "server-only";
import type { ModoLoja } from "@/lib/agenda";
import { bancoConfigurado, obterBanco } from "@/server/db";

/**
 * Chave abrir/fechar do admin, guardada no banco (tabela estado_loja).
 * Sem banco (ou se a leitura falhar), a loja segue o calendário ("automatico").
 */
const MODOS: ModoLoja[] = ["automatico", "aberto", "fechado", "mais_tarde"];

export const modoValido = (v: unknown): v is ModoLoja => MODOS.includes(v as ModoLoja);

/** Modo da loja e, no "mais_tarde", a hora em que abre hoje (minutos do dia; null = sem hora). */
export type EstadoLoja = { modo: ModoLoja; abreAs: number | null };

const AUTOMATICO: EstadoLoja = { modo: "automatico", abreAs: null };

export async function lerEstadoLoja(): Promise<EstadoLoja> {
  if (!bancoConfigurado()) return AUTOMATICO;
  try {
    // "Abre mais tarde" vale só no dia em que foi escolhido; no dia seguinte volta ao automático.
    // abre_as lido via jsonb para funcionar também antes da migração 0007.
    const [linha] = await obterBanco().consulta<{ modo: string; abre_as: number | null; hoje: boolean }>(
      `select modo, (to_jsonb(e) ->> 'abre_as')::int as abre_as,
              (atualizado_em at time zone 'America/Sao_Paulo')::date
                = (now() at time zone 'America/Sao_Paulo')::date as hoje
         from estado_loja e`,
    );
    if (!linha || !modoValido(linha.modo)) return AUTOMATICO;
    if (linha.modo === "mais_tarde")
      return linha.hoje ? { modo: "mais_tarde", abreAs: linha.abre_as } : AUTOMATICO;
    return { modo: linha.modo, abreAs: null };
  } catch (erro) {
    console.error("modo-loja: falha ao ler o banco —", erro instanceof Error ? erro.message : erro);
    return AUTOMATICO;
  }
}

export const lerModoLoja = async () => (await lerEstadoLoja()).modo;

export async function gravarModoLoja(
  modo: ModoLoja,
  abreAs: number | null = null,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!bancoConfigurado()) return { ok: false, erro: "Banco de dados não configurado." };
  try {
    const db = obterBanco();
    await db.consulta(
      `insert into estado_loja (id, modo, atualizado_em) values (true, $1, now())
       on conflict (id) do update set modo = excluded.modo, atualizado_em = now()`,
      [modo],
    );
    if (modo === "mais_tarde") await db.consulta("update estado_loja set abre_as = $1", [abreAs]);
  } catch (erro) {
    console.error("modo-loja: falha ao gravar —", erro instanceof Error ? erro.message : erro);
    return {
      ok: false,
      erro: "Não foi possível salvar. Se o banco ainda não foi atualizado, rode as migrações.",
    };
  }
  return { ok: true };
}
