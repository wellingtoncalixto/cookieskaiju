import "server-only";
import { unstable_cache } from "next/cache";
import { horarioPadrao, lerHorarioSemana, type HorarioSemana } from "@/lib/horario";
import { bancoConfigurado, obterBanco } from "@/server/db";

/**
 * Horário de funcionamento por dia da semana, guardado no banco (tabela horario_funcionamento).
 * Sem banco, sem a tabela (migração 0008 ainda não rodou) ou com falha de leitura: o padrão de src/config/loja.ts.
 */

/** Tag do cache das páginas do site que mostram o horário: o admin chama revalidateTag ao salvar. */
export const TAG_HORARIO = "horario";

type Linha = { dia_semana: number; aberto: boolean; abre_min: number; fecha_min: number };

async function lerDoBanco(): Promise<HorarioSemana> {
  const linhas = await obterBanco().consulta<Linha>(
    "select dia_semana, aberto, abre_min, fecha_min from horario_funcionamento order by dia_semana",
  );
  // Começa do padrão e troca os dias que vieram do banco; se o resultado não for válido, fica o padrão.
  const semana = horarioPadrao();
  for (const l of linhas)
    if (l.dia_semana >= 0 && l.dia_semana <= 6)
      semana[l.dia_semana] = { aberto: l.aberto, abre: l.abre_min, fecha: l.fecha_min };
  return lerHorarioSemana(semana) ?? horarioPadrao();
}

function comPadrao(ler: () => Promise<HorarioSemana>) {
  return async (): Promise<HorarioSemana> => {
    if (!bancoConfigurado()) return horarioPadrao();
    try {
      return await ler();
    } catch (erro) {
      console.error("horario: falha ao ler o banco —", erro instanceof Error ? erro.message : erro);
      return horarioPadrao();
    }
  };
}

/** Leitura direta (admin, /api/loja). */
export const lerHorario = comPadrao(lerDoBanco);

/** Leitura com cache, para as páginas estáticas do site (textos e JSON-LD). */
export const horarioDoSite = comPadrao(unstable_cache(lerDoBanco, ["horario-v1"], { tags: [TAG_HORARIO] }));

/** Grava os 7 dias (já validados) numa instrução só. */
export async function gravarHorario(h: HorarioSemana): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!bancoConfigurado()) return { ok: false, erro: "Banco de dados não configurado." };
  const valido = lerHorarioSemana(h);
  if (!valido) return { ok: false, erro: "Horário inválido." };
  try {
    await obterBanco().consulta(
      `insert into horario_funcionamento (dia_semana, aberto, abre_min, fecha_min, atualizado_em)
       select d.dia_semana, d.aberto, d.abre_min, d.fecha_min, now()
         from jsonb_to_recordset($1::jsonb) as d(dia_semana smallint, aberto boolean, abre_min int, fecha_min int)
       on conflict (dia_semana) do update
         set aberto = excluded.aberto, abre_min = excluded.abre_min, fecha_min = excluded.fecha_min,
             atualizado_em = now()`,
      [
        JSON.stringify(
          valido.map((d, dia) => ({
            dia_semana: dia,
            aberto: d.aberto,
            abre_min: d.abre,
            fecha_min: d.fecha,
          })),
        ),
      ],
    );
  } catch (erro) {
    console.error("horario: falha ao gravar —", erro instanceof Error ? erro.message : erro);
    return {
      ok: false,
      erro: "Não foi possível salvar. Se o banco ainda não foi atualizado, rode as migrações.",
    };
  }
  return { ok: true };
}
