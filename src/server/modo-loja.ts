import "server-only";
import type { ModoLoja } from "@/lib/agenda";
import { bancoConfigurado, obterBanco } from "@/server/db";

/**
 * Chave abrir/fechar do admin, guardada no banco (tabela estado_loja).
 * Sem banco (ou se a leitura falhar), a loja segue o calendário ("automatico").
 */
const MODOS: ModoLoja[] = ["automatico", "aberto", "fechado", "mais_tarde"];

export const modoValido = (v: unknown): v is ModoLoja => MODOS.includes(v as ModoLoja);

export async function lerModoLoja(): Promise<ModoLoja> {
  if (!bancoConfigurado()) return "automatico";
  try {
    // "Abre mais tarde" vale só no dia em que foi escolhido; no dia seguinte volta ao automático.
    const [linha] = await obterBanco().consulta<{ modo: string; hoje: boolean }>(
      `select modo, (atualizado_em at time zone 'America/Sao_Paulo')::date
                    = (now() at time zone 'America/Sao_Paulo')::date as hoje
         from estado_loja`,
    );
    if (linha?.modo === "mais_tarde" && !linha.hoje) return "automatico";
    return modoValido(linha?.modo) ? linha.modo : "automatico";
  } catch (erro) {
    console.error("modo-loja: falha ao ler o banco —", erro instanceof Error ? erro.message : erro);
    return "automatico";
  }
}

export async function gravarModoLoja(modo: ModoLoja): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!bancoConfigurado()) return { ok: false, erro: "Banco de dados não configurado." };
  try {
    await obterBanco().consulta(
      `insert into estado_loja (id, modo, atualizado_em) values (true, $1, now())
       on conflict (id) do update set modo = excluded.modo, atualizado_em = now()`,
      [modo],
    );
  } catch (erro) {
    console.error("modo-loja: falha ao gravar —", erro instanceof Error ? erro.message : erro);
    return {
      ok: false,
      erro: "Não foi possível salvar. Se o banco ainda não foi atualizado, rode as migrações.",
    };
  }
  return { ok: true };
}
