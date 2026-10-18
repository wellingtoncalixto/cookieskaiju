import { describe, expect, it } from "vitest";
import { CHAVE_AGORA, calcularAgenda } from "@/lib/agenda";
import { errosEntrega, errosPagamento, etapaPendente } from "@/lib/validacao";

// Sábado 14h (aberto) e segunda 10h (fechado), em São Paulo.
const aberta = calcularAgenda(new Date("2026-10-17T14:00:00-03:00"));
const fechada = calcularAgenda(new Date("2026-10-12T10:00:00-03:00"));
const ctx = (agenda = aberta, quantidade = 2) => ({ quantidade, agenda });

const endereco = { rua: "Rua A", numero: "10", bairro: "Centro", cidade: "Mogi Mirim" };
const completo = {
  horario: "2026-10-17|16h",
  endereco,
  nome: "Ana",
  pagamento: "pix" as string | null,
};

describe("validação das etapas", () => {
  it("entrega completa não tem erros", () => {
    expect(errosEntrega(ctx(), completo).mensagens).toEqual([]);
  });

  it("lista os erros na ordem dos campos e marca os campos", () => {
    const e = errosEntrega(ctx(), {
      horario: null,
      endereco: { rua: "", numero: " ", bairro: "", cidade: "x" },
    });
    expect(e.mensagens).toEqual([
      "Escolha quando quer receber o pedido.",
      "Informe a rua.",
      "Informe o número.",
      "Informe o bairro.",
    ]);
    expect(e.campos).toEqual(["horario", "rua", "numero", "bairro"]);
  });

  it("retirada não exige endereço, só o horário", () => {
    const vazio = { rua: "", numero: "", bairro: "", cidade: "" };
    expect(
      errosEntrega(ctx(), { modalidade: "retirada", horario: completo.horario, endereco: vazio }).mensagens,
    ).toEqual([]);
    expect(errosEntrega(ctx(), { modalidade: "retirada", horario: null, endereco: vazio }).mensagens).toEqual(
      ["Escolha quando quer retirar o pedido."],
    );
  });

  it("faixa que já passou é inválida", () => {
    expect(errosEntrega(ctx(), { ...completo, horario: "2026-10-17|13h" }).campos).toContain("horario");
  });

  it("loja fechada não bloqueia: aceita horário agendado, mas não 'o quanto antes'", () => {
    expect(errosEntrega(ctx(fechada), completo).mensagens).toEqual([]);
    expect(errosEntrega(ctx(fechada), { ...completo, horario: CHAVE_AGORA }).campos).toContain("horario");
    expect(errosEntrega(ctx(aberta), { ...completo, horario: CHAVE_AGORA }).mensagens).toEqual([]);
  });

  it("nome e pagamento são obrigatórios (sem campo de WhatsApp)", () => {
    expect(errosPagamento({ nome: "", pagamento: null }).mensagens).toEqual([
      "Informe seu nome.",
      "Escolha a forma de pagamento.",
    ]);
    expect(errosPagamento({ nome: "Ana", pagamento: "dinheiro" }).mensagens).toEqual([]);
  });
});

describe("guarda de etapas", () => {
  it("sacola vazia volta para o início", () => {
    expect(etapaPendente("revisao", ctx(aberta, 0), completo)).toBe("inicio");
  });

  it("pular a entrega volta para a entrega", () => {
    expect(etapaPendente("revisao", ctx(), { ...completo, endereco: { ...endereco, rua: "" } })).toBe(
      "entrega",
    );
    expect(etapaPendente("pagamento", ctx(), { ...completo, horario: null })).toBe("entrega");
  });

  it("pular os dados volta para o pagamento", () => {
    expect(etapaPendente("revisao", ctx(), { ...completo, nome: "" })).toBe("pagamento");
  });

  it("tudo certo libera a etapa, mesmo com a loja fechada", () => {
    expect(etapaPendente("revisao", ctx(), completo)).toBeNull();
    expect(etapaPendente("revisao", ctx(fechada), completo)).toBeNull();
  });
});
