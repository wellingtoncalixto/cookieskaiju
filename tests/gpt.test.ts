import { afterEach, describe, expect, it } from "vitest";
import { autorizado, sqlAceito } from "@/server/gpt";

describe("acesso do ChatGPT", () => {
  afterEach(() => {
    delete process.env.GPT_API_CHAVE;
  });

  it("aceita só uma instrução SELECT/WITH", () => {
    expect(sqlAceito("select * from pedidos;")).toBe("select * from pedidos");
    expect(sqlAceito("  WITH x as (select 1) select * from x")).toBe("WITH x as (select 1) select * from x");
    expect(sqlAceito("delete from pedidos")).toBeNull();
    expect(sqlAceito("select 1; drop table pedidos")).toBeNull();
    expect(sqlAceito("")).toBeNull();
  });

  it("exige a chave Bearer certa (e uma chave longa configurada)", () => {
    const req = (h?: string) => new Request("https://x/api", { headers: h ? { authorization: h } : {} });
    expect(autorizado(req("Bearer qualquer"))).toBe(false);
    process.env.GPT_API_CHAVE = "curta";
    expect(autorizado(req("Bearer curta"))).toBe(false);
    process.env.GPT_API_CHAVE = "k".repeat(32);
    expect(autorizado(req(`Bearer ${"k".repeat(32)}`))).toBe(true);
    expect(autorizado(req(`Bearer ${"k".repeat(31)}`))).toBe(false);
    expect(autorizado(req())).toBe(false);
  });
});
