"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAgenda } from "@/hooks/useAgenda";
import { useResumoPedido } from "@/hooks/useResumoPedido";
import { errosEntrega, errosPagamento, etapaPendente, type Erros } from "@/lib/validacao";
import { usePedido } from "@/store/pedido";
import { useSacola } from "@/store/sacola";

const ROTA = {
  inicio: "/",
  entrega: "/pedido/entrega",
  pagamento: "/pedido/pagamento",
  revisao: "/pedido/revisao",
};
const vazio: Erros = { mensagens: [], campos: [] };

/** Estado completo do checkout + validação de cada etapa. */
export function useCheckout() {
  const hidratada = useSacola((s) => s.hidratada);
  const situacao = useAgenda();
  const pedido = usePedido();
  const resumo = useResumoPedido(situacao?.agenda ?? null);

  const ctx = situacao
    ? { quantidade: resumo.quantidade, agenda: situacao.agenda, textoAgenda: situacao.textos.texto }
    : null;
  const dados = {
    modalidade: pedido.modalidade,
    horario: pedido.horario,
    endereco: pedido.endereco,
    nome: pedido.nome,
    pagamento: pedido.pagamento,
  };

  return {
    pronto: hidratada && ctx !== null,
    situacao,
    pedido,
    resumo,
    ctx,
    dados,
    erros: {
      entrega: ctx ? errosEntrega(ctx, dados) : vazio,
      pagamento: errosPagamento(dados),
    },
  };
}

/**
 * Guarda de etapa: sacola vazia volta para "/", etapa pulada volta para a primeira pendente.
 * Retorna `true` quando a etapa pode ser exibida.
 */
export function useGuardaEtapa(
  etapa: "entrega" | "pagamento" | "revisao" | "enviado",
  c: ReturnType<typeof useCheckout>,
) {
  const router = useRouter();
  let destino: keyof typeof ROTA | null = null;
  if (c.pronto && c.ctx) {
    destino =
      etapa === "enviado"
        ? c.pedido.mensagemEnviada
          ? null
          : "inicio"
        : etapaPendente(etapa, c.ctx, c.dados);
  }

  useEffect(() => {
    if (destino) router.replace(ROTA[destino]);
  }, [destino, router]);

  return c.pronto && destino === null;
}
