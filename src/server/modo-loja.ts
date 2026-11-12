import "server-only";
import type { ModoLoja } from "@/lib/agenda";
import type { HorarioSemana } from "@/lib/horario";
import { bancoConfigurado, obterBanco } from "@/server/db";
import { lerHorario } from "@/server/horario";

/**
 * Modo da loja do admin, guardado no banco (tabela estado_loja):
 * "automatico" segue o horário de funcionamento; "aberto"/"fechado" é o manual ("Loja aberta agora").
 * O manual vale só no dia (São Paulo) em que foi escolhido: à meia-noite volta sozinho ao automático.
 * Sem banco (ou se a leitura falhar), a loja segue o horário ("automatico").
 */
const MODOS: ModoLoja[] = ["automatico", "aberto", "fechado"];

export const modoValido = (v: unknown): v is ModoLoja => MODOS.includes(v as ModoLoja);

/** Modo da loja e horário de funcionamento (o que o site precisa para calcular a agenda). */
export type EstadoLoja = { modo: ModoLoja; horario: HorarioSemana };

export async function lerModoLoja(): Promise<ModoLoja> {
  if (!bancoConfigurado()) return "automatico";
  try {
    const [linha] = await obterBanco().consulta<{ modo: string; hoje: boolean }>(
      `select modo,
              (atualizado_em at time zone 'America/Sao_Paulo')::date
                = (now() at time zone 'America/Sao_Paulo')::date as hoje
         from estado_loja`,
    );
    if (!linha || !modoValido(linha.modo)) return "automatico";
    // Manual de outro dia: já passou da meia-noite, segue o horário.
    return linha.modo !== "automatico" && !linha.hoje ? "automatico" : linha.modo;
  } catch (erro) {
    console.error("modo-loja: falha ao ler o banco —", erro instanceof Error ? erro.message : erro);
    return "automatico";
  }
}

export async function lerEstadoLoja(): Promise<EstadoLoja> {
  const [modo, horario] = await Promise.all([lerModoLoja(), lerHorario()]);
  return { modo, horario };
}

export async function gravarModoLoja(modo: ModoLoja): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!bancoConfigurado()) return { ok: false, erro: "Banco de dados não configurado." };
  if (!modoValido(modo)) return { ok: false, erro: "Opção inválida." };
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
