"use client";

import { useEffect, useState } from "react";
import { MODO_TESTE } from "@/config/loja";
import { calcularAgenda, textosAgenda, type Agenda, type ModoLoja } from "@/lib/agenda";
import { horarioPadrao, lerHorarioSemana, type HorarioSemana } from "@/lib/horario";

export type SituacaoAgenda = { agenda: Agenda; agora: number; textos: ReturnType<typeof textosAgenda> };

type Estado = { modo: ModoLoja; horario: HorarioSemana };

const MODOS: ModoLoja[] = ["automatico", "aberto", "fechado"];

function calcular({ modo, horario }: Estado): SituacaoAgenda {
  const agora = Date.now();
  const agenda = calcularAgenda(agora, { modoTeste: MODO_TESTE, modoLoja: modo, horario });
  return { agenda, agora, textos: textosAgenda(agenda, agora) };
}

// Modo da loja e horário de funcionamento do admin, compartilhados por todos os componentes da página.
let estadoAtual: Estado = { modo: "automatico", horario: horarioPadrao() };
let ultimaLeitura = 0;
let primeiraLeitura: Promise<void> | null = null;
const ouvintes = new Set<() => void>();

async function lerEstado() {
  if (Date.now() - ultimaLeitura < 20_000) return;
  ultimaLeitura = Date.now();
  try {
    const r = await fetch("/api/loja");
    const j = (await r.json()) as { modo?: unknown; horario?: unknown };
    const modo = MODOS.includes(j.modo as ModoLoja) ? (j.modo as ModoLoja) : null;
    const horario = lerHorarioSemana(j.horario);
    if (!modo || !horario) return;
    if (modo !== estadoAtual.modo || JSON.stringify(horario) !== JSON.stringify(estadoAtual.horario)) {
      estadoAtual = { modo, horario };
      ouvintes.forEach((f) => f());
    }
  } catch {
    // Sem resposta: segue o horário padrão (ou a última leitura).
  }
}

/**
 * Situação da agenda, calculada só no cliente (as páginas são estáticas) e
 * atualizada a cada 30 segundos, junto com o modo e o horário do admin. Retorna `null` até montar.
 * Na primeira vez, espera a leitura de /api/loja (até 2 s) para não mostrar um horário velho.
 */
export function useAgenda(): SituacaoAgenda | null {
  const [s, setS] = useState<SituacaoAgenda | null>(null);
  useEffect(() => {
    let vivo = true;
    const atualizar = () => {
      if (vivo) setS(calcular(estadoAtual));
    };
    ouvintes.add(atualizar);
    primeiraLeitura ??= lerEstado();
    const limite = new Promise((ok) => setTimeout(ok, 2_000));
    void Promise.race([primeiraLeitura, limite]).then(atualizar);
    const id = setInterval(() => {
      atualizar();
      void lerEstado();
    }, 30_000);
    return () => {
      vivo = false;
      ouvintes.delete(atualizar);
      clearInterval(id);
    };
  }, []);
  return s;
}
