import { describe, expect, it } from "vitest";
import { assinarCotacao, lerCotacao } from "@/lib/assinatura";
import { gerarIdPedido, idPedidoValido } from "@/lib/id-pedido";
import { esquemaEntrada, montarRegistro, type EntradaRegistro } from "@/lib/registro-pedido";

const SEGREDO = "segredo-ficticio-de-teste";
// Sábado 24/10/2026, 14h05 em São Paulo.
const AGORA = new Date("2026-10-24T14:05:00-03:00").getTime();

describe("ID do pedido", () => {
  it("formato CK-AAMMDD-XXXXX com a data de São Paulo", () => {
    const id = gerarIdPedido(AGORA);
    expect(id).toMatch(/^CK-261024-[0-9A-HJKMNP-TV-Z]{7}$/);
    expect(idPedidoValido(id)).toBe(true);
  });

  it("nunca parece um ID histórico e recusa formatos estranhos", () => {
    for (const ruim of ["1", "8", 7, "CK-261024-AAAAAA", "CK-261024-AAAAAAI", "ck-261024-AAAAAAA", ""]) {
      expect(idPedidoValido(ruim)).toBe(false);
    }
  });

  it("2 mil IDs no mesmo dia sem repetição (bem acima do volume real)", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => gerarIdPedido(AGORA)));
    expect(ids.size).toBe(2000);
  });
});

describe("cotação de frete assinada", () => {
  const cot = { cep: "13802067", km1Decimal: 4.2, kmCobrado: 5, valor: 5 };

  it("lê a cotação assinada pelo servidor", () => {
    expect(lerCotacao(assinarCotacao(cot, SEGREDO, AGORA), SEGREDO, AGORA)).toMatchObject(cot);
  });

  it("recusa valor adulterado, outro segredo e cotação vencida (3h)", () => {
    const token = assinarCotacao(cot, SEGREDO, AGORA);
    const [dados, sig] = token.split(".");
    const adulterado = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(dados, "base64url").toString()), valor: 0 }),
    ).toString("base64url");
    expect(lerCotacao(`${adulterado}.${sig}`, SEGREDO, AGORA)).toBeNull();
    expect(lerCotacao(token, "outro", AGORA)).toBeNull();
    expect(lerCotacao(token, SEGREDO, AGORA + 3 * 3600_000 + 1)).toBeNull();
    expect(lerCotacao("lixo", SEGREDO, AGORA)).toBeNull();
  });
});

describe("montagem do registro no servidor", () => {
  const ler = (t?: string) => lerCotacao(t, SEGREDO, AGORA);
  const base: EntradaRegistro = {
    id: "CK-261024-AAAAAAA",
    modalidade: "entrega",
    horario: "agora",
    itens: [{ slug: "kinder", quantidade: 1 }],
    pagamento: "pix",
    cidade: "Mogi Mirim",
    cep: "13802-067",
    cotacao: assinarCotacao({ cep: "13802067", km1Decimal: 4.2, kmCobrado: 5, valor: 5 }, SEGREDO, AGORA),
  };

  it("um sabor, entrega: data e hora do servidor, frete da cotação, rótulos da planilha", () => {
    const r = montarRegistro(base, AGORA, ler);
    expect(r).toEqual({
      ok: true,
      corpo: {
        id: "CK-261024-AAAAAAA",
        data: "2026-10-24",
        hora: "14:05",
        cidade: "Mogi Mirim",
        distanciaKm: 4.2,
        pagamento: "Pix",
        status: "Pendente",
        frete: 5,
        origem: "site",
        atendimento: "Entrega",
        relacao: "",
        comoConheceu: "",
        tipoRegistro: "Site automático",
        itens: [{ produto: "Kinder", quantidade: 1 }],
      },
    });
  });

  it("vários sabores: um item por sabor; promoção (3+ em Mogi Mirim) zera o frete", () => {
    const r = montarRegistro(
      {
        ...base,
        itens: [
          { slug: "explosao-de-nutella", quantidade: 2 },
          { slug: "ninho-black", quantidade: 1 },
        ],
      },
      AGORA,
      ler,
    );
    expect(r.ok && r.corpo.itens).toEqual([
      { produto: "Explosão de Nutella", quantidade: 2 },
      { produto: "Ninho Black", quantidade: 1 },
    ]);
    expect(r.ok && [r.corpo.frete, r.corpo.distanciaKm]).toEqual([0, 4.2]);
  });

  it("retirada: sem cidade, distância e frete zero", () => {
    const r = montarRegistro({ ...base, modalidade: "retirada", cidade: "", cotacao: undefined }, AGORA, ler);
    expect(r.ok && [r.corpo.atendimento, r.corpo.cidade, r.corpo.distanciaKm, r.corpo.frete]).toEqual([
      "Retirada",
      "",
      0,
      0,
    ]);
  });

  it("frete sem cotação válida (a confirmar, adulterada ou de outro CEP): em branco, sem inventar", () => {
    for (const entrada of [
      { ...base, cotacao: undefined },
      { ...base, cotacao: "falsa.assinatura" },
      { ...base, cep: "13800-000" },
    ]) {
      const r = montarRegistro(entrada, AGORA, ler);
      expect(r.ok && [r.corpo.frete, r.corpo.distanciaKm]).toEqual(["", ""]);
    }
  });

  it("cartão vira o texto que as fórmulas reconhecem", () => {
    const credito = montarRegistro({ ...base, pagamento: "credito" }, AGORA, ler);
    const debito = montarRegistro({ ...base, pagamento: "debito" }, AGORA, ler);
    expect(credito.ok && credito.corpo.pagamento).toBe("InfiniteTap crédito");
    expect(debito.ok && debito.corpo.pagamento).toBe("InfiniteTap débito");
  });

  it("cidade digitada sem acento vira o nome oficial", () => {
    const r = montarRegistro({ ...base, cidade: "mogi guacu" }, AGORA, ler);
    expect(r.ok && r.corpo.cidade).toBe("Mogi Guaçu");
  });

  it("recusa produto desconhecido e sabor repetido; preço nunca vem do navegador", () => {
    expect(montarRegistro({ ...base, itens: [{ slug: "pirata", quantidade: 1 }] }, AGORA, ler)).toEqual({
      ok: false,
      erro: "produto_desconhecido",
    });
    expect(
      montarRegistro(
        {
          ...base,
          itens: [
            { slug: "kinder", quantidade: 1 },
            { slug: "kinder", quantidade: 2 },
          ],
        },
        AGORA,
        ler,
      ),
    ).toEqual({ ok: false, erro: "produto_repetido" });
  });

  it("o esquema recusa dados pessoais extras e quantidades absurdas", () => {
    const comNome = esquemaEntrada.safeParse({ ...base, nome: "Maria", telefone: "19999998888" });
    // Campos extras são descartados pelo zod (nunca chegam à planilha).
    expect(comNome.success && "nome" in comNome.data).toBe(false);
    expect(esquemaEntrada.safeParse({ ...base, itens: [{ slug: "kinder", quantidade: 500 }] }).success).toBe(
      false,
    );
    expect(esquemaEntrada.safeParse({ ...base, id: "5" }).success).toBe(false);
  });
});
