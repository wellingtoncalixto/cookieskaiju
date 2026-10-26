import { afterEach, describe, expect, it } from "vitest";
import { usarBanco } from "@/server/db";
import { gravarModoLoja, lerModoLoja } from "@/server/modo-loja";
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

  it("sem banco: segue o calendário e não grava", async () => {
    const antes = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(await lerModoLoja()).toBe("automatico");
    expect((await gravarModoLoja("fechado")).ok).toBe(false);
    if (antes) process.env.DATABASE_URL = antes;
  });
});
