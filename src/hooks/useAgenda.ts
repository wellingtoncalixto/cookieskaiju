"use client";

import { useEffect, useState } from "react";
import { MODO_TESTE } from "@/config/loja";
import { calcularAgenda, textosAgenda, type Agenda } from "@/lib/agenda";

export type SituacaoAgenda = { agenda: Agenda; agora: number; textos: ReturnType<typeof textosAgenda> };

function calcular(): SituacaoAgenda {
  const agora = Date.now();
  const agenda = calcularAgenda(agora, { modoTeste: MODO_TESTE });
  return { agenda, agora, textos: textosAgenda(agenda, agora) };
}

/**
 * Situação da agenda, calculada só no cliente (as páginas são estáticas) e
 * atualizada a cada 30 segundos. Retorna `null` até montar.
 */
export function useAgenda(): SituacaoAgenda | null {
  const [s, setS] = useState<SituacaoAgenda | null>(null);
  useEffect(() => {
    const atualizar = () => setS(calcular());
    const primeiro = setTimeout(atualizar, 0);
    const id = setInterval(atualizar, 30_000);
    return () => {
      clearTimeout(primeiro);
      clearInterval(id);
    };
  }, []);
  return s;
}
