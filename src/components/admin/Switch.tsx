"use client";

/**
 * Chave liga/desliga acessível: checkbox nativo com role="switch", rótulo visível na linha inteira
 * (alvo de 48 px) e o texto do estado ao lado (não depende só da cor).
 */
export function Switch({
  id,
  rotulo,
  ligado,
  aoMudar,
  textoLigado = "Ligado",
  textoDesligado = "Desligado",
  descricao,
}: {
  id: string;
  rotulo: React.ReactNode;
  ligado: boolean;
  aoMudar: (ligado: boolean) => void;
  textoLigado?: string;
  textoDesligado?: string;
  /** id do texto de apoio (aria-describedby). */
  descricao?: string;
}) {
  return (
    <label className="adm-switch" htmlFor={id}>
      <span className="adm-switch-rotulo">{rotulo}</span>
      {/* O leitor de tela já anuncia ligado/desligado pelo role="switch". */}
      <span className="adm-switch-estado" aria-hidden="true">
        {ligado ? textoLigado : textoDesligado}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={ligado}
        aria-describedby={descricao}
        onChange={(e) => aoMudar(e.target.checked)}
      />
    </label>
  );
}
