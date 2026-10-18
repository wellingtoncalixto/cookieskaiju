"use client";

import { useMemo } from "react";
import { dataDoHorario, type Agenda } from "@/lib/agenda";
import { avaliarPromo, dicaPromo, resolverTaxa, type Taxa } from "@/lib/frete";
import { agoraSaoPaulo, isoData } from "@/lib/tempo";
import { usePedido } from "@/store/pedido";
import { quantidadeTotal, subtotalSacola, useSacola } from "@/store/sacola";

/** Subtotal, promoção, taxa e total do pedido atual. */
export function useResumoPedido(agenda: Agenda | null) {
  const itens = useSacola((s) => s.itens);
  const modalidade = usePedido((s) => s.modalidade);
  const cidade = usePedido((s) => s.endereco.cidade);
  const horario = usePedido((s) => s.horario);
  const frete = usePedido((s) => s.frete);

  return useMemo(() => {
    const quantidade = quantidadeTotal(itens);
    const subtotal = subtotalSacola(itens);
    if (modalidade === "retirada") {
      const taxa: Taxa = { tipo: "retirada", valor: 0 };
      return { quantidade, subtotal, promo: null, taxa, dica: "", total: subtotal };
    }
    // A promoção compara com a data de ENTREGA: a escolhida (hoje, se for "o quanto antes") ou a próxima.
    const dataEntrega = dataDoHorario(agenda, horario) ?? agenda?.dias[0]?.data ?? isoData(agoraSaoPaulo());
    const promo = cidade ? avaliarPromo({ cidade, quantidade, dataEntrega }) : null;
    const taxa = resolverTaxa(frete, promo);
    return {
      quantidade,
      subtotal,
      promo,
      taxa,
      dica: dicaPromo(promo, quantidade),
      total: subtotal + (taxa.valor ?? 0),
    };
  }, [itens, modalidade, cidade, horario, frete, agenda]);
}
