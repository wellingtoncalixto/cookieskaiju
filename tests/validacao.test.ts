import { describe, expect, it } from "vitest";
import { calcularAgenda } from "@/lib/agenda";
import { errosEntrega, errosPagamento, etapaPendente } from "@/lib/validacao";

const aberta = calcularAgenda(new Date("2026-10-14T10:00:00-03:00"));
const fechada = calcularAgenda(new Date("2026-10-12T10:00:00-03:00"));
const ctx = (agenda = aberta, quantidade = 2) => ({ quantidade, agenda, textoAgenda: "Texto da agenda." });

const endereco = { rua: "Rua A", numero: "10", bairro: "Centro", cidade: "Mogi Mirim" };
const completo = {
  horario: "2026-10-17|noite",
  endereco,
  nome: "Ana",
  telefone: "(19) 99999-8888",
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
      "Escolha o dia e a janela de entrega.",
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
      ["Escolha o dia e a janela de retirada."],
    );
  });

  it("horário que não existe mais na agenda é inválido", () => {
    expect(errosEntrega(ctx(), { ...completo, horario: "2026-10-10|noite" }).campos).toContain("horario");
  });

  it("agenda fechada bloqueia a entrega", () => {
    expect(errosEntrega(ctx(fechada), completo).mensagens[0]).toBe(
      "A agenda está fechada agora. Texto da agenda.",
    );
  });

  it("telefone precisa de pelo menos 10 dígitos e pagamento é obrigatório", () => {
    expect(errosPagamento({ nome: "", telefone: "(19) 9999", pagamento: null }).mensagens).toEqual([
      "Informe seu nome.",
      "Informe um WhatsApp com DDD.",
      "Escolha a forma de pagamento.",
    ]);
    expect(
      errosPagamento({ nome: "Ana", telefone: "(19) 3333-4444", pagamento: "dinheiro" }).mensagens,
    ).toEqual([]);
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

  it("tudo certo libera a etapa", () => {
    expect(etapaPendente("revisao", ctx(), completo)).toBeNull();
    expect(etapaPendente("entrega", ctx(fechada), completo)).toBeNull();
  });
});
