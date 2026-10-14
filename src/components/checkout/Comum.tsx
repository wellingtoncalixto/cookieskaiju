"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { IconeVoltar } from "@/components/Icones";
import { brl } from "@/lib/formato";

/** Lista de erros acima do botão. Recalculada a cada render, então se atualiza enquanto o cliente corrige. */
export function ListaErros({ mensagens, visivel }: { mensagens: string[]; visivel: boolean }) {
  return (
    <div aria-live="polite">
      {visivel && mensagens.length > 0 && (
        <ul className="errors">
          {mensagens.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Linha "Total" da barra de ação. */
export function TotalAcao({ total, aConfirmar }: { total: number; aConfirmar: boolean }) {
  return (
    <div className="tot">
      <span>Total</span>
      <b className="tnum" aria-live="polite">
        {brl(total)}
        {aConfirmar && " + entrega"}
      </b>
    </div>
  );
}

/** Cabeçalho fixo: voltar, título da etapa, "Etapa X de 3" e barra de progresso. */
export function CabecalhoEtapa({
  titulo,
  subtitulo,
  etapa,
  voltarPara,
}: {
  titulo: string;
  subtitulo: string;
  etapa?: 1 | 2 | 3;
  voltarPara: string;
}) {
  const router = useRouter();
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    h1.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, []);

  function voltar() {
    // Mesmo efeito do "voltar" do navegador; sem histórico interno, vai para a etapa anterior.
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
    else router.push(voltarPara);
  }

  return (
    <header className="appbar">
      <div className="col bar">
        <button className="iconbtn" type="button" aria-label="Voltar" onClick={voltar}>
          <IconeVoltar />
        </button>
        <h1 ref={h1} tabIndex={-1}>
          {titulo}
          <span className="sub">{subtitulo}</span>
        </h1>
        <span />
      </div>
      {etapa && (
        <div className="col">
          <div className="progress" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <span key={n} className={n <= etapa ? "on" : undefined} />
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

export function Carregando() {
  return (
    <div className="col screen" aria-busy="true">
      <div className="block carregando-bloco">
        <p className="fmsg">
          <span className="spin" aria-hidden="true" />
          Carregando…
        </p>
      </div>
    </div>
  );
}
