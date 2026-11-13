import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { usarBanco } from "@/server/db";
import { bancoDeTeste } from "./apoio/banco";

// Dados fictícios (o repositório é público).
type Rota = (request: Request) => Promise<Response>;
let postPedido: Rota;
let postNumero: Rota;
let b: Awaited<ReturnType<typeof bancoDeTeste>>;

beforeAll(async () => {
  // Liga o registro antes de carregar as rotas (a chave é lida ao importar).
  vi.stubEnv("NEXT_PUBLIC_REGISTRO_PEDIDOS", "true");
  postPedido = (await import("../app/api/pedidos/route")).POST;
  postNumero = (await import("../app/api/pedidos/numero/route")).POST;
});
afterAll(() => vi.unstubAllEnvs());

beforeEach(async () => {
  b = await bancoDeTeste();
  await b.consulta(
    `insert into produtos (slug, nome, preco, custo_unitario, estoque) values ('alfa', 'Alfa', 18, 6, 3)`,
  );
  await b.consulta(`insert into configuracao (chave, valor) values
    ('kraft_preco', 1.5), ('kraft_cookies_por_saco', 5), ('flyer_aquecimento', 0.7), ('flyer_marca', 0.91),
    ('moto_km_por_litro', 20), ('gasolina_litro', 6.6), ('taxa_pix', 0), ('taxa_credito', 0.0315),
    ('taxa_debito', 0.0137), ('taxa_dinheiro', 0)`);
  usarBanco(b);
});
afterEach(() => usarBanco(null));

let n = 0;
const corpoPedido = () =>
  JSON.stringify({
    id: `CK-261024-${String(++n).padStart(7, "R")}`,
    modalidade: "retirada",
    horario: "agora",
    itens: [{ slug: "alfa", quantidade: 3 }],
    pagamento: "pix",
  });

/** Requisição como o navegador manda; `cabecalhos` substitui ou remove (undefined) os padrões. */
function requisicao(caminho: string, corpo: string, cabecalhos: Record<string, string | undefined> = {}) {
  const h: Record<string, string | undefined> = {
    host: "cookieskaiju.test",
    origin: "https://cookieskaiju.test",
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
    "x-forwarded-for": `10.0.0.${++n}`,
    ...cabecalhos,
  };
  const headers = new Headers();
  for (const [k, v] of Object.entries(h)) if (v !== undefined) headers.set(k, v);
  return new Request(`https://cookieskaiju.test${caminho}`, { method: "POST", headers, body: corpo });
}

const estoqueAlfa = async () =>
  (await b.consulta<{ estoque: number }>("select estoque from produtos where slug = 'alfa'"))[0].estoque;
const totalPedidos = async () => (await b.consulta("select id from pedidos")).length;

describe("/api/pedidos aceita só envio do próprio site", () => {
  it("mesmo site: 200, grava o pedido e não mexe no estoque", async () => {
    const r = await postPedido(requisicao("/api/pedidos", corpoPedido()));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, duplicado: false });
    expect(await totalPedidos()).toBe(1);
    expect(await estoqueAlfa()).toBe(3);
  });

  it("charset no Content-Type e ferramenta sem Origin nem Sec-Fetch-Site: aceita", async () => {
    const com = requisicao("/api/pedidos", corpoPedido(), {
      "content-type": "application/json; charset=utf-8",
    });
    expect((await postPedido(com)).status).toBe(200);
    const semNavegador = requisicao("/api/pedidos", corpoPedido(), {
      origin: undefined,
      "sec-fetch-site": undefined,
    });
    expect((await postPedido(semNavegador)).status).toBe(200);
  });

  it("outro site: 403 definitivo, sem gravar", async () => {
    for (const cab of [
      { origin: "https://outro-site.test", "sec-fetch-site": "cross-site" },
      { origin: "https://outro-site.test", "sec-fetch-site": undefined },
      { origin: undefined, "sec-fetch-site": "cross-site" },
      { "sec-fetch-site": "same-site" },
      { origin: "null", "sec-fetch-site": undefined },
    ]) {
      const r = await postPedido(requisicao("/api/pedidos", corpoPedido(), cab));
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ ok: false, erro: "origem_recusada", definitivo: true });
    }
    expect(await totalPedidos()).toBe(0);
  });

  it("text/plain (formulário ou envio simples): 415 definitivo, sem gravar", async () => {
    for (const tipo of ["text/plain", "application/x-www-form-urlencoded", undefined]) {
      const r = await postPedido(requisicao("/api/pedidos", corpoPedido(), { "content-type": tipo }));
      expect(r.status).toBe(415);
      expect(await r.json()).toEqual({ ok: false, erro: "tipo_invalido", definitivo: true });
    }
    expect(await totalPedidos()).toBe(0);
  });
});

describe("/api/pedidos/numero aceita só envio do próprio site", () => {
  const chave = JSON.stringify({ chave: "CK-261024-NNNNNNN" });

  it("mesmo site: devolve o número", async () => {
    const r = await postNumero(requisicao("/api/pedidos/numero", chave));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ numero: expect.any(Number) });
  });

  it("outro site: 403; text/plain: 415; nada reservado", async () => {
    const fora = await postNumero(
      requisicao("/api/pedidos/numero", chave, {
        origin: "https://outro-site.test",
        "sec-fetch-site": "cross-site",
      }),
    );
    expect(fora.status).toBe(403);
    expect(await fora.json()).toEqual({ ok: false, erro: "origem_recusada", definitivo: true });
    const texto = await postNumero(
      requisicao("/api/pedidos/numero", chave, { "content-type": "text/plain" }),
    );
    expect(texto.status).toBe(415);
    expect(await texto.json()).toEqual({ ok: false, erro: "tipo_invalido", definitivo: true });
    expect(await b.consulta("select chave from reservas_numero")).toEqual([]);
  });
});
