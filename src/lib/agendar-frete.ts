"use client";

import { normalizar, soDigitos } from "@/lib/formato";
import type { EstadoFrete } from "@/lib/frete";
import type { Endereco } from "@/lib/mensagem";
import { usePedido } from "@/store/pedido";

// O agendamento fica fora da tela de propósito: se o cliente avançar de etapa antes dos 900 ms (ou com
// o cálculo em andamento), o frete termina do mesmo jeito. Antes, sair da tela cancelava o cálculo e o
// pedido seguia com a taxa "a confirmar".
let agendamentoFrete: ReturnType<typeof setTimeout> | null = null;

export function agendarFrete(e: Endereco) {
  const { definir } = usePedido.getState();
  const cep = soDigitos(e.cep);
  const temCep = cep.length === 8;
  const completo = temCep || (e.rua.trim() && e.numero.trim() && e.bairro.trim() && e.cidade.trim());
  // Com CEP, o número não muda a localização: digitar o número não refaz o cálculo.
  const chave = temCep ? `cep:${cep}` : [e.rua, e.numero, e.bairro, e.cidade, e.uf].map(normalizar).join("|");
  if (!completo) {
    if (agendamentoFrete) clearTimeout(agendamentoFrete);
    agendamentoFrete = null;
    if (usePedido.getState().frete.status !== "vazio")
      definir({ frete: { status: "vazio" }, freteChave: "" });
    return;
  }
  const atual = usePedido.getState();
  if (chave === atual.freteChave && atual.frete.status !== "vazio") return;

  // Marca o endereço em cálculo: a resposta só vale se ainda for deste endereço.
  definir({ freteChave: chave });
  if (agendamentoFrete) clearTimeout(agendamentoFrete);
  agendamentoFrete = setTimeout(async () => {
    agendamentoFrete = null;
    if (usePedido.getState().freteChave !== chave) return;
    definir({ frete: { status: "calculando" } });
    let frete: EstadoFrete;
    try {
      // O CEP é localizado daqui do navegador: cada cliente usa a própria cota do serviço de CEP
      // (do servidor, o IP compartilhado da hospedagem esbarra no limite de requisições).
      const coordCep = temCep ? await localizarCep(cep) : null;
      const r = await fetch("/api/frete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep: e.cep,
          rua: e.rua,
          numero: e.numero,
          bairro: e.bairro,
          cidade: e.cidade,
          uf: e.uf || "SP",
          coordCep,
        }),
      });
      if (!r.ok) throw new Error();
      const j = (await r.json()) as {
        km1Decimal: number;
        kmCobrado: number;
        valor: number;
        aproximado: boolean;
        cotacao?: string;
      };
      frete = { status: "ok", ...j };
    } catch {
      frete = { status: "falhou" };
    }
    if (usePedido.getState().freteChave === chave) definir({ frete });
  }, 900);
}

/** Há cálculo de frete agendado ou em andamento? (o registro do pedido espera a cotação). */
export const freteEmAndamento = () =>
  agendamentoFrete !== null || usePedido.getState().frete.status === "calculando";

/** CEP → coordenadas (AwesomeAPI), consultado pelo navegador. Retorna `null` se não houver coordenada. */
async function localizarCep(cep: string) {
  try {
    const r = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { lat?: string; lng?: string; city?: string };
    const lat = Number(j.lat);
    const lon = Number(j.lng);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, cidade: j.city ?? "" } : null;
  } catch {
    return null;
  }
}
