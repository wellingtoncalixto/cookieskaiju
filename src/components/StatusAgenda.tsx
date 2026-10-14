"use client";

import { useAgenda } from "@/hooks/useAgenda";

/**
 * Selo da agenda com contagem regressiva (atualizada a cada 30 s).
 * Antes de montar, mostra um placeholder com texto invisível do mesmo tamanho do final,
 * para o cartão nascer com a altura certa e não gerar layout shift.
 */
export function StatusAgenda() {
  const s = useAgenda();
  if (!s) {
    return (
      <div className="status-row" aria-hidden="true">
        {/* Mesma largura do selo mais longo, para o texto quebrar igual ao final. */}
        <span className="pill carregando">
          <span style={{ visibility: "hidden" }}>Agenda fechada</span>
        </span>
        <p style={{ visibility: "hidden" }}>
          <span className="count">Fecha em 0d 0h 00min.</span> Pedidos para sábado 00/00 e domingo 00/00.
        </p>
      </div>
    );
  }
  return (
    <div className="status-row" aria-live="polite" aria-atomic="true">
      <span className={`pill ${s.agenda.teste ? "aberta" : s.agenda.modo}`}>{s.textos.selo}</span>
      <p>
        {s.textos.contagem && <span className="count tnum">{s.textos.contagem}</span>} {s.textos.texto}
      </p>
    </div>
  );
}
