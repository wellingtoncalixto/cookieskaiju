"use client";

import { useEffect, useState } from "react";
import { MODO_TESTE } from "@/config/loja";
import { calcularAgenda, textosAgenda, type Agenda, type ModoLoja } from "@/lib/agenda";

export type SituacaoAgenda = { agenda: Agenda; agora: number; textos: ReturnType<typeof textosAgenda> };

function calcular(modoLoja: ModoLoja): SituacaoAgenda {
  const agora = Date.now();
  const agenda = calcularAgenda(agora, { modoTeste: MODO_TESTE, modoLoja });
  return { agenda, agora, textos: textosAgenda(agenda, agora) };
}

// Chave abrir/fechar do admin, compartilhada por todos os componentes da página.
let modoAtual: ModoLoja = "automatico";
let ultimaLeitura = 0;
const ouvintes = new Set<() => void>();

async function lerModo() {
  if (Date.now() - ultimaLeitura < 20_000) return;
  ultimaLeitura = Date.now();
  try {
    const r = await fetch("/api/loja");
    const j = (await r.json()) as { modo?: ModoLoja };
    if (j.modo && j.modo !== modoAtual) {
      modoAtual = j.modo;
      ouvintes.forEach((f) => f());
    }
  } catch {
    // Sem resposta: segue o calendário (ou a última leitura).
  }
}

/**
 * Situação da agenda, calculada só no cliente (as páginas são estáticas) e
 * atualizada a cada 30 segundos, junto com a chave abrir/fechar do admin. Retorna `null` até montar.
 */
export function useAgenda(): SituacaoAgenda | null {
  const [s, setS] = useState<SituacaoAgenda | null>(null);
  useEffect(() => {
    const atualizar = () => setS(calcular(modoAtual));
    ouvintes.add(atualizar);
    const primeiro = setTimeout(atualizar, 0);
    void lerModo();
    const id = setInterval(() => {
      atualizar();
      void lerModo();
    }, 30_000);
    return () => {
      ouvintes.delete(atualizar);
      clearTimeout(primeiro);
      clearInterval(id);
    };
  }, []);
  return s;
}
