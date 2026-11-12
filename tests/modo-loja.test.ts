import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { horarioPadrao } from "@/lib/horario";
import { usarBanco } from "@/server/db";
import { gravarHorario, lerHorario } from "@/server/horario";
import { gravarModoLoja, lerEstadoLoja, lerModoLoja } from "@/server/modo-loja";
import { bancoDeTeste } from "./apoio/banco";

describe("modo da loja no banco (automático ou manual)", () => {
  afterEach(() => usarBanco(null));

  it("começa no automático, grava e lê", async () => {
    usarBanco(await bancoDeTeste());
    expect(await lerModoLoja()).toBe("automatico");
    expect(await gravarModoLoja("fechado")).toEqual({ ok: true });
    expect(await lerModoLoja()).toBe("fechado");
    await gravarModoLoja("aberto");
    expect(await lerModoLoja()).toBe("aberto");
    await gravarModoLoja("automatico");
    expect(await lerModoLoja()).toBe("automatico");
  });

  it("o manual volta sozinho ao automático à meia-noite de São Paulo", async () => {
    const b = await bancoDeTeste();
    usarBanco(b);
    await gravarModoLoja("aberto");
    // Ainda hoje em São Paulo (início do dia): continua manual.
    await b.consulta(
      `update estado_loja set atualizado_em =
         date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'`,
    );
    expect(await lerModoLoja()).toBe("aberto");
    // Um segundo antes da meia-noite de hoje: era ontem. Volta ao automático.
    await b.consulta("update estado_loja set atualizado_em = atualizado_em - interval '1 second'");
    expect(await lerModoLoja()).toBe("automatico");
    await gravarModoLoja("fechado");
    await b.consulta("update estado_loja set atualizado_em = now() - interval '1 day'");
    expect(await lerModoLoja()).toBe("automatico");
  });

  it("não aceita modo inválido (nem o antigo 'mais_tarde')", async () => {
    const b = await bancoDeTeste();
    usarBanco(b);
    expect((await gravarModoLoja("mais_tarde" as never)).ok).toBe(false);
    await expect(b.consulta("update estado_loja set modo = 'mais_tarde'")).rejects.toThrow();
    expect(await lerModoLoja()).toBe("automatico");
  });

  it("sem banco: segue o horário padrão e não grava", async () => {
    const antes = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(await lerEstadoLoja()).toEqual({ modo: "automatico", horario: horarioPadrao() });
    expect((await gravarModoLoja("fechado")).ok).toBe(false);
    expect((await gravarHorario(horarioPadrao())).ok).toBe(false);
    if (antes) process.env.DATABASE_URL = antes;
  });
});

describe("horário de funcionamento no banco", () => {
  afterEach(() => usarBanco(null));

  it("começa com sábado e domingo, 13h às 18h (o que já valia)", async () => {
    usarBanco(await bancoDeTeste());
    expect(await lerHorario()).toEqual(horarioPadrao());
    expect((await lerEstadoLoja()).horario).toEqual(horarioPadrao());
  });

  it("grava e lê os 7 dias, guardando as horas dos dias fechados", async () => {
    usarBanco(await bancoDeTeste());
    const h = horarioPadrao();
    h[5] = { aberto: true, abre: 18 * 60, fecha: 22 * 60 };
    h[0] = { aberto: false, abre: 10 * 60, fecha: 12 * 60 };
    expect(await gravarHorario(h)).toEqual({ ok: true });
    expect(await lerHorario()).toEqual(h);
  });

  it("recusa horário inválido no servidor e no banco", async () => {
    const b = await bancoDeTeste();
    usarBanco(b);
    const h = horarioPadrao();
    h[6] = { aberto: true, abre: 17 * 60, fecha: 17 * 60 + 30 };
    expect((await gravarHorario(h)).ok).toBe(false);
    await expect(
      b.consulta("update horario_funcionamento set fecha_min = abre_min + 30 where dia_semana = 6"),
    ).rejects.toThrow();
    await expect(
      b.consulta("update horario_funcionamento set abre_min = 785 where dia_semana = 6"),
    ).rejects.toThrow();
    expect(await lerHorario()).toEqual(horarioPadrao());
  });

  it("falha de leitura (tabela ainda não criada): usa o padrão de loja.ts", async () => {
    const b = await bancoDeTeste();
    usarBanco(b);
    await b.consulta("drop table horario_funcionamento");
    expect(await lerHorario()).toEqual(horarioPadrao());
    expect((await gravarHorario(horarioPadrao())).ok).toBe(false);
  });
});

describe("migração 0008 (fim do 'abre mais tarde')", () => {
  const pasta = join(process.cwd(), "db", "migracoes");
  const arquivos = readdirSync(pasta)
    .filter((a) => a.endsWith(".sql"))
    .sort();
  const aplicar = async (pg: PGlite, filtro: (a: string) => boolean) => {
    for (const a of arquivos.filter(filtro)) await pg.exec(readFileSync(join(pasta, a), "utf8"));
  };

  it("troca 'mais_tarde' por automático, remove abre_as e cria o horário inicial", async () => {
    const pg = new PGlite();
    await aplicar(pg, (a) => a < "0008");
    await pg.exec("update estado_loja set modo = 'mais_tarde', abre_as = 900");
    await aplicar(pg, (a) => a.startsWith("0008"));
    const { rows } = await pg.query<{ modo: string }>("select modo from estado_loja");
    expect(rows).toEqual([{ modo: "automatico" }]);
    const colunas = await pg.query("select 1 from information_schema.columns where column_name = 'abre_as'");
    expect(colunas.rows).toEqual([]);
    const dias = await pg.query<{ dia_semana: number; aberto: boolean; abre_min: number; fecha_min: number }>(
      "select dia_semana, aberto, abre_min, fecha_min from horario_funcionamento order by dia_semana",
    );
    expect(dias.rows.filter((d) => d.aberto).map((d) => d.dia_semana)).toEqual([0, 6]);
    expect(dias.rows.every((d) => d.abre_min === 780 && d.fecha_min === 1080)).toBe(true);
    expect(dias.rows).toHaveLength(7);
  });

  it("mantém o manual de hoje e pode rodar de novo sem estragar o horário salvo", async () => {
    const pg = new PGlite();
    await aplicar(pg, (a) => a < "0008");
    await pg.exec("update estado_loja set modo = 'fechado'");
    await aplicar(pg, (a) => a.startsWith("0008"));
    await pg.exec("update horario_funcionamento set aberto = true where dia_semana = 5");
    await aplicar(pg, (a) => a.startsWith("0008"));
    expect((await pg.query("select modo from estado_loja")).rows).toEqual([{ modo: "fechado" }]);
    expect((await pg.query("select aberto from horario_funcionamento where dia_semana = 5")).rows).toEqual([
      { aberto: true },
    ]);
  });
});
