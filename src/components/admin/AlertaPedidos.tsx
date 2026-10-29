"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type PedidoNovo = {
  numero: number;
  criadoEm: number;
  modalidade: "entrega" | "retirada" | null;
  entregaData: string | null;
  entregaFaixa: string | null;
  total: number;
  itens: { nome: string; quantidade: number }[];
};

const INTERVALO_MS = 15_000;
const REPETIR_SOM_MS = 30_000;
const MAX_REPETICOES = 5;
const CHAVE_PREFERENCIA = "ck_alerta_som";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hora = (ms: number) =>
  new Date(ms).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
const quando = (p: PedidoNovo) =>
  p.entregaFaixa === "agora"
    ? "para hoje"
    : p.entregaData
      ? `agendado ${p.entregaData.slice(8, 10)}/${p.entregaData.slice(5, 7)} · ${p.entregaFaixa ?? ""}`
      : "";
const resumoItens = (p: PedidoNovo) => p.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(", ");

/** Toca um "plim-plom" curto com a Web Audio API (sem arquivo de som). */
function tocar(ctx: AudioContext) {
  const agora = ctx.currentTime;
  for (const [i, freq] of [880, 1320, 880, 1320].entries()) {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const inicio = agora + i * 0.22;
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(0.5, inicio + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.2);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(inicio);
    osc.stop(inicio + 0.21);
  }
}

/**
 * Alerta de pedido novo no admin: confere a cada 15 s; quando chega pedido, toca um som (depois que o alerta sonoro
 * é ativado com um toque), abre um pop-up com o pedido, avisa pelo sistema (se permitido), vibra e atualiza a página.
 * Com o alerta ativo, também mantém a tela ligada (o navegador para de conferir com a tela apagada).
 */
export function AlertaPedidos() {
  const router = useRouter();
  const ultimo = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const tela = useRef<WakeLockSentinel | null>(null);
  const [somAtivo, setSomAtivo] = useState(false);
  const [novos, setNovos] = useState<PedidoNovo[]>([]);
  const repeticoes = useRef(0);

  const manterTelaLigada = useCallback(async () => {
    try {
      if ("wakeLock" in navigator && !tela.current) {
        tela.current = await navigator.wakeLock.request("screen");
        tela.current.addEventListener("release", () => (tela.current = null));
      }
    } catch {
      // Sem permissão (ex.: bateria fraca): segue sem manter a tela ligada.
    }
  }, []);

  async function ativarSom() {
    audio.current ??= new AudioContext();
    await audio.current.resume();
    tocar(audio.current);
    setSomAtivo(true);
    try {
      localStorage.setItem(CHAVE_PREFERENCIA, "1");
    } catch {}
    if ("Notification" in window && Notification.permission === "default")
      void Notification.requestPermission();
    void manterTelaLigada();
  }

  function desativarSom() {
    setSomAtivo(false);
    void tela.current?.release();
    try {
      localStorage.removeItem(CHAVE_PREFERENCIA);
    } catch {}
  }

  // A preferência fica salva, mas o navegador exige um toque por visita para liberar o som.
  const [lembrarAtivar, setLembrarAtivar] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lê a preferência salva só no navegador
      setLembrarAtivar(localStorage.getItem(CHAVE_PREFERENCIA) === "1");
    } catch {}
  }, []);

  // Volta a manter a tela ligada quando a aba volta a ficar visível.
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && somAtivo) void manterTelaLigada();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [somAtivo, manterTelaLigada]);

  // Conferência periódica.
  useEffect(() => {
    let parado = false;
    async function conferir() {
      try {
        const q = ultimo.current == null ? "" : `?desde=${ultimo.current}`;
        const r = await fetch(`/admin/novidades${q}`, { cache: "no-store" });
        if (r.status === 401) {
          parado = true;
          return;
        }
        if (!r.ok) return;
        const j = (await r.json()) as { ultimo: number; pedidos: PedidoNovo[] };
        if (ultimo.current == null) {
          ultimo.current = j.ultimo;
          return;
        }
        if (j.pedidos.length) {
          ultimo.current = j.ultimo;
          setNovos((atual) => [...atual, ...j.pedidos]);
          repeticoes.current = 0;
          router.refresh();
        }
      } catch {
        // Sem conexão: tenta de novo no próximo ciclo.
      }
    }
    void conferir();
    const id = setInterval(() => {
      if (!parado) void conferir();
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [router]);

  // Som, notificação, vibração e título enquanto houver pedido novo não visto.
  const quantidade = novos.length;
  useEffect(() => {
    if (!quantidade) return;
    const semPrefixo = (t: string) => t.replace(/^\(\d+\) Novo pedido · /, "");
    const prefixo = `(${quantidade}) Novo pedido · `;
    document.title = prefixo + semPrefixo(document.title);
    // A atualização da página reescreve o título: reaplica enquanto houver pedido não visto.
    const titulo = setInterval(() => {
      if (!document.title.startsWith(prefixo)) document.title = prefixo + semPrefixo(document.title);
    }, 1000);
    const avisar = () => {
      if (somAtivo && audio.current) tocar(audio.current);
      navigator.vibrate?.([300, 150, 300]);
    };
    avisar();
    const ultimoPedido = novos.at(-1)!;
    if (
      "Notification" in window &&
      Notification.permission === "granted" &&
      document.visibilityState !== "visible"
    ) {
      new Notification(`Novo pedido #${ultimoPedido.numero}`, {
        body: `${resumoItens(ultimoPedido)} · ${brl(ultimoPedido.total)}`,
        tag: "ck-pedido",
      });
    }
    const id = setInterval(() => {
      if (repeticoes.current >= MAX_REPETICOES) return clearInterval(id);
      repeticoes.current += 1;
      avisar();
    }, REPETIR_SOM_MS);
    return () => {
      clearInterval(id);
      clearInterval(titulo);
      document.title = semPrefixo(document.title);
    };
  }, [quantidade, novos, somAtivo]);

  return (
    <>
      <button
        type="button"
        className={`adm-btn pequeno adm-sino${somAtivo ? " ativo" : ""}`}
        onClick={somAtivo ? desativarSom : ativarSom}
        aria-pressed={somAtivo}
        title={somAtivo ? "Desligar o som dos pedidos novos" : "Tocar som quando entrar pedido"}
      >
        {somAtivo
          ? "🔔 Alerta ligado"
          : lembrarAtivar
            ? "🔕 Toque para religar o alerta"
            : "🔕 Ativar alerta sonoro"}
      </button>

      {quantidade > 0 &&
        // Portal no <body>: o cabeçalho (com desfoque) prenderia um elemento fixo dentro dele.
        createPortal(
          <div className="adm-alerta-fundo">
            <div className="adm-alerta" role="alertdialog" aria-modal="true" aria-labelledby="alerta-titulo">
              <p className="adm-alerta-titulo" id="alerta-titulo">
                {quantidade === 1 ? "Novo pedido!" : `${quantidade} pedidos novos!`}
              </p>
              <ul>
                {novos.map((p) => (
                  <li key={p.numero}>
                    <b>#{p.numero}</b> · {p.modalidade === "retirada" ? "Retirada" : "Entrega"} {quando(p)} ·
                    feito às {hora(p.criadoEm)}
                    <br />
                    {resumoItens(p)} · <b>{brl(p.total)}</b>
                  </li>
                ))}
              </ul>
              <div className="adm-acoes">
                <Link className="adm-btn primario" href="/admin" onClick={() => setNovos([])}>
                  Ver pedidos
                </Link>
                <button type="button" className="adm-btn" onClick={() => setNovos([])} autoFocus>
                  OK
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
