import { afterEach, describe, expect, it } from "vitest";
import { usarBanco } from "@/server/db";
import { gravarModoLoja, lerEstadoLoja, lerModoLoja } from "@/server/modo-loja";
import { bancoDeTeste } from "./apoio/banco";

describe("chave abrir/fechar no banco", () => {
  afterEach(() => usarBanco(null));

  it("começa no automático, grava e lê", async () => {
    usarBanco(await bancoDeTeste());
    expect(await lerModoLoja()).toBe("automatico");
    expect(await gravarModoLoja("fechado")).toEqual({ ok: true });
    expect(await lerModoLoja()).toBe("fechado");
    await gravarModoLoja("aberto");
    expect(await lerModoLoja()).toBe("aberto");
  });

  it("abre mais tarde vale só no dia em que foi escolhido", async () => {
    const b = await bancoDeTeste();
    usarBanco(b);
    await gravarModoLoja("mais_tarde", 15 * 60);
    expect(await lerEstadoLoja()).toEqual({ modo: "mais_tarde", abreAs: 900 });
    await gravarModoLoja("mais_tarde");
    expect(await lerEstadoLoja()).toEqual({ modo: "mais_tarde", abreAs: null });
    await b.consulta("update estado_loja set atualizado_em = now() - interval '1 day'");
    expect(await lerModoLoja()).toBe("automatico");
  });

  it("sem banco: segue o calendário e não grava", async () => {
    const antes = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(await lerModoLoja()).toBe("automatico");
    expect((await gravarModoLoja("fechado")).ok).toBe(false);
    if (antes) process.env.DATABASE_URL = antes;
  });
});
