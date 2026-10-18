import { describe, expect, it } from "vitest";
import type { Taxa } from "@/lib/frete";
import { linkWhatsApp, montarMensagemWhatsApp, type PedidoMensagem } from "@/lib/mensagem";

const base: PedidoMensagem = {
  itens: [
    { nome: "Explosão de Nutella", quantidade: 2, preco: 18 },
    { nome: "Duplo Maltine", quantidade: 1, preco: 23 },
  ],
  teste: false,
  horario: "Sábado, 17/10 · 14h às 15h",
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
  cliente: { nome: "Maria Souza" },
  obs: "",
};

const gratis: Taxa = { tipo: "gratis", valor: 0, cidade: "Mogi Mirim", min: 3 };
const confirmar: Taxa = { tipo: "confirmar", valor: null };

describe("montarMensagemWhatsApp", () => {
  it("frete calculado", () => {
    const msg = montarMensagemWhatsApp(base);
    expect(msg).toContain("*Taxa de entrega:* R$ 5,00\n");
    expect(msg).not.toMatch(/\d km/);
    expect(msg).toContain("*TOTAL: R$ 64,00*");
    expect(msg).toContain("*Pagamento:* Cartão por aproximação (na entrega)");
    expect(msg).toMatchSnapshot();
  });

  it("frete estimado só pelo bairro", () => {
    const msg = montarMensagemWhatsApp({
      ...base,
      taxa: { tipo: "calculada", valor: 6, km1Decimal: 5.2, kmCobrado: 6, aproximado: true },
    });
    expect(msg).toContain("*Taxa de entrega:* R$ 6,00 (estimada pelo bairro)");
  });

  it("retirada: sem endereço, sem rota e sem taxa", () => {
    const msg = montarMensagemWhatsApp({
      ...base,
      modalidade: "retirada",
      taxa: { tipo: "retirada", valor: 0 },
    });
    expect(msg).toContain("*Retirada*\nSábado, 17/10 · 14h às 15h\nLocal: a combinar com a loja");
    expect(msg).toContain("*TOTAL: R$ 59,00*");
    expect(msg).toContain("*Pagamento:* Cartão por aproximação (na retirada)");
    expect(msg).not.toContain("Rua Exemplo");
    expect(msg).not.toContain("Rota:");
    expect(msg).not.toContain("Taxa de entrega");
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
    const pix = montarMensagemWhatsApp({ ...base, pagamento: "pix", obs: "Interfone quebrado" });
    expect(pix).toContain("*Pagamento:* Pix\n");
    expect(pix.endsWith("*Obs.:* Interfone quebrado")).toBe(true);
    expect(pix).toMatchSnapshot();
  });

  it("pedido para agora", () => {
    const msg = montarMensagemWhatsApp({ ...base, horario: "O quanto antes (hoje, 17/10)" });
    expect(msg).toContain("*Entrega*\nO quanto antes (hoje, 17/10)\n");
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
