import { loja, type FormaPagamento } from "@/config/loja";
import { brl, valorTroco } from "@/lib/formato";
import type { Taxa } from "@/lib/frete";

export type Endereco = {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  referencia: string;
};

export type PedidoMensagem = {
  /** ID do pedido (CK-AAMMDD-XXXXXXX), quando o registro no Painel está ligado. */
  id?: string;
  itens: { nome: string; quantidade: number; preco: number }[];
  /** Ausente = entrega. */
  modalidade?: "entrega" | "retirada";
  teste: boolean;
  /** "Sábado, 24/10 · 14h às 15h" ou "Hoje, 18/10 · entre 15h10 e 15h40 (60 a 90 min após o pedido)" */
  horario: string;
  endereco: Endereco;
  taxa: Taxa;
  pagamento: FormaPagamento["id"];
  troco: string;
  /** Sem telefone: o número do cliente chega junto com a própria mensagem no WhatsApp. */
  cliente: { nome: string };
  obs: string;
};

const limpar = (s: string) => s.trim();

/** Origem da rota no link do Google Maps (só vai na mensagem para a loja; não aparece no site). */
export const origemRota = () => `${loja.frete.origemCep}, ${loja.frete.origemCidade} - ${loja.uf}`;

export function linkRota(e: Endereco): string {
  const uf = (limpar(e.uf) || loja.uf).toUpperCase();
  const destino = `${limpar(e.rua)}, ${limpar(e.numero)} - ${limpar(e.bairro)}, ${limpar(e.cidade)} - ${uf}${
    limpar(e.cep) ? ", " + limpar(e.cep) : ""
  }`;
  return (
    "https://www.google.com/maps/dir/?api=1&travelmode=driving" +
    `&origin=${encodeURIComponent(origemRota())}&destination=${encodeURIComponent(destino)}`
  );
}

export const subtotalItens = (itens: PedidoMensagem["itens"]) =>
  itens.reduce((s, i) => s + i.quantidade * i.preco, 0);

function linhaTaxa(taxa: Taxa): string {
  switch (taxa.tipo) {
    case "gratis":
      return `GRÁTIS (promoção de lançamento, ${taxa.cidade})`;
    case "calculada":
      // Sem km: a loja confere a distância pelo link "Rota" da própria mensagem.
      return `${brl(taxa.valor)}${taxa.aproximado ? " (estimada pelo bairro)" : ""}`;
    default:
      return "a confirmar pela loja";
  }
}

/** "Pix" · "Cartão de crédito por aproximação (na entrega)" · "Dinheiro · troco para R$ 100" */
export function linhaPagamento(
  id: FormaPagamento["id"] | null,
  troco: string,
  modalidade: "entrega" | "retirada" = "entrega",
): string {
  const forma = loja.pagamentos.find((p) => p.id === id);
  let txt = forma ? forma.naMensagem : "-";
  if (modalidade === "retirada") txt = txt.replace("(na entrega)", "(na retirada)");
  if (id === "dinheiro" && valorTroco(troco)) txt += ` · troco para R$ ${valorTroco(troco)}`;
  return txt;
}

export function montarMensagemWhatsApp(p: PedidoMensagem): string {
  const e = p.endereco;
  const uf = (limpar(e.uf) || loja.uf).toUpperCase();
  const subtotal = subtotalItens(p.itens);
  const total = subtotal + (p.taxa.valor ?? 0);

  const L: string[] = ["*NOVO PEDIDO · COOKIES KAIJU*"];
  if (p.id) L.push(`Pedido: ${p.id}`);
  if (p.teste) L.push("_PEDIDO DE TESTE_");

  L.push("", "*Cookies*");
  for (const i of p.itens) L.push(`${i.quantidade}x ${i.nome} · ${brl(i.quantidade * i.preco)}`);
  L.push(`Subtotal: ${brl(subtotal)}`);

  if (p.modalidade === "retirada") {
    L.push("", "*Retirada*", p.horario, "Local: a combinar com a loja");
    L.push("", `*TOTAL: ${brl(total)}*`);
  } else {
    L.push("", "*Entrega*", p.horario);
    L.push(
      `${limpar(e.rua)}, ${limpar(e.numero)}${limpar(e.complemento) ? " · " + limpar(e.complemento) : ""}`,
    );
    L.push(
      `${limpar(e.bairro)} · ${limpar(e.cidade)}/${uf}${limpar(e.cep) ? " · CEP " + limpar(e.cep) : ""}`,
    );
    if (limpar(e.referencia)) L.push(`Referência: ${limpar(e.referencia)}`);
    L.push(`Rota: ${linkRota(e)}`);

    L.push("", `*Taxa de entrega:* ${linhaTaxa(p.taxa)}`);
    L.push(`*TOTAL: ${brl(total)}*${p.taxa.valor === null ? " + entrega" : ""}`);
  }

  L.push("", `*Pagamento:* ${linhaPagamento(p.pagamento, p.troco, p.modalidade)}`);

  L.push("", "*Cliente*", limpar(p.cliente.nome));

  if (limpar(p.obs)) L.push("", `*Obs.:* ${limpar(p.obs)}`);
  return L.join("\n");
}

export const linkWhatsApp = (mensagem: string, numero: string = loja.contato.whatsapp) =>
  `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
