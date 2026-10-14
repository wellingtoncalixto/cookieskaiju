import { describe, expect, it } from "vitest";
import type { Taxa } from "@/lib/frete";
import { linkWhatsApp, montarMensagemWhatsApp, type PedidoMensagem } from "@/lib/mensagem";

const base: PedidoMensagem = {
  itens: [
    { nome: "Explosão de Nutella", quantidade: 2, preco: 18 },
    { nome: "Duplo Maltine", quantidade: 1, preco: 23 },
  ],
  prontaEntrega: false,
  teste: false,
  horario: "Sábado, 17/10 · 18h às 20h",
  endereco: {
    cep: "13800-000",
    rua: "Rua Exemplo",
    numero: "123",
    complemento: "Apto 4",
    bairro: "Centro",
    cidade: "Mogi Mirim",
    uf: "SP",
    referencia: "portão preto",
  },
  taxa: { tipo: "calculada", valor: 5, km1Decimal: 4.2, kmCobrado: 5, aproximado: false },
  pagamento: "cartao",
  troco: "",
  cliente: { nome: "Maria Souza", telefone: "(19) 99999-8888" },
  obs: "",
};

const gratis: Taxa = { tipo: "gratis", valor: 0, cidade: "Mogi Mirim", min: 3 };
const confirmar: Taxa = { tipo: "confirmar", valor: null };

describe("montarMensagemWhatsApp", () => {
  it("frete calculado", () => {
    const msg = montarMensagemWhatsApp(base);
    expect(msg).toContain("*Taxa de entrega:* R$ 5,00 (estimado: 4,2 km de rota, conta como 5 km)");
    expect(msg).toContain("*TOTAL: R$ 64,00*");
    expect(msg).toContain("*Pagamento:* Cartão por aproximação (na entrega)");
    expect(msg).toMatchSnapshot();
  });

  it("frete grátis pela promoção", () => {
    const msg = montarMensagemWhatsApp({ ...base, taxa: gratis });
    expect(msg).toContain("*Taxa de entrega:* GRÁTIS (promoção de lançamento, Mogi Mirim)");
    expect(msg).toContain("*TOTAL: R$ 59,00*");
    expect(msg).toMatchSnapshot();
  });

  it("frete a confirmar", () => {
    const msg = montarMensagemWhatsApp({ ...base, taxa: confirmar });
    expect(msg).toContain("*Taxa de entrega:* a confirmar pela loja");
    expect(msg).toContain("*TOTAL: R$ 59,00* + entrega");
    expect(msg).toMatchSnapshot();
  });

  it("dinheiro com troco", () => {
    const msg = montarMensagemWhatsApp({ ...base, pagamento: "dinheiro", troco: "100" });
    expect(msg).toContain("*Pagamento:* Dinheiro · troco para R$ 100");
    expect(montarMensagemWhatsApp({ ...base, pagamento: "dinheiro", troco: "R$ 50,00" })).toContain(
      "troco para R$ 50,00",
    );
    expect(msg).toMatchSnapshot();
  });

  it("dinheiro sem troco, Pix e observação", () => {
    expect(montarMensagemWhatsApp({ ...base, pagamento: "dinheiro" })).toContain("*Pagamento:* Dinheiro\n");
    const pix = montarMensagemWhatsApp({ ...base, pagamento: "pix", obs: "É presente" });
    expect(pix).toContain("*Pagamento:* Pix\n");
    expect(pix.endsWith("*Obs.:* É presente")).toBe(true);
    expect(pix).toMatchSnapshot();
  });

  it("pronta-entrega", () => {
    const msg = montarMensagemWhatsApp({ ...base, prontaEntrega: true });
    expect(msg.split("\n")[1]).toBe("_Pronta-entrega (sujeito a estoque)_");
    expect(msg).toMatchSnapshot();
  });

  it("modo teste", () => {
    const msg = montarMensagemWhatsApp({ ...base, teste: true });
    expect(msg.split("\n")[1]).toBe("_PEDIDO DE TESTE_");
    expect(msg).toMatchSnapshot();
  });

  it("sem complemento e sem referência", () => {
    const msg = montarMensagemWhatsApp({
      ...base,
      endereco: { ...base.endereco, complemento: "", referencia: "" },
    });
    expect(msg).toContain("\nRua Exemplo, 123\n");
    expect(msg).not.toContain("Referência");
  });

  it("link do WhatsApp codifica a mensagem", () => {
    expect(linkWhatsApp("a b&c", "5519984268415")).toBe("https://wa.me/5519984268415?text=a%20b%26c");
  });
});
