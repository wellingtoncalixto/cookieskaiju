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
          <span style={{ visibility: "hidden" }}>Fechado agora</span>
        </span>
        <p style={{ visibility: "hidden" }}>
          <span className="count">Abre em 0d 00h 00min.</span> Abrimos sábado, 00/00, às 13h. Você já pode
          fazer o pedido e agendar o horário.
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
