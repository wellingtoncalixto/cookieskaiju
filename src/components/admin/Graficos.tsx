"use client";

import { useState } from "react";

/**
 * Gráficos do financeiro, em HTML (sem biblioteca). Regras: marcas finas com ponta arredondada, um só eixo,
 * valores escritos em cor de texto (a cor fica na marca), dica ao passar o dedo/mouse ou focar com o teclado,
 * e todo valor também visível sem a dica (rótulo ou tabela).
 */

export type Cor = "azul" | "laranja" | "verde" | "amarelo" | "cinza" | "vermelho";
const COR: Record<Cor, string> = {
  azul: "var(--viz-1)",
  laranja: "var(--viz-2)",
  verde: "var(--viz-3)",
  amarelo: "var(--viz-4)",
  cinza: "var(--viz-cinza)",
  vermelho: "var(--viz-neg)",
};

type Dica = { x: number; y: number; titulo: string; valor: string; detalhe?: string } | null;

function useDica() {
  const [dica, setDica] = useState<Dica>(null);
  const mostrar =
    (titulo: string, valor: string, detalhe?: string) =>
    (e: React.PointerEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => {
      const caixa = e.currentTarget.closest(".graf")!.getBoundingClientRect();
      const alvo = e.currentTarget.getBoundingClientRect();
      const x = "clientX" in e ? e.clientX - caixa.left : alvo.left + alvo.width / 2 - caixa.left;
      const y = ("clientY" in e ? e.clientY : alvo.top) - caixa.top;
      setDica({ x, y, titulo, valor, detalhe });
    };
  const esconder = () => setDica(null);
  const balao = dica && (
    <div
      className="graf-dica"
      role="status"
      style={{ left: Math.max(8, dica.x), top: Math.max(0, dica.y - 12) }}
    >
      <b>{dica.valor}</b>
      <span>{dica.titulo}</span>
      {dica.detalhe && <span>{dica.detalhe}</span>}
    </div>
  );
  return { mostrar, esconder, balao };
}

export type ItemBarra = { rotulo: string; valor: number; texto: string; detalhe?: string; cor?: Cor };

/** Barras horizontais com o valor na ponta. Comprimento relativo ao maior valor (ou a `maximo`). */
export function BarrasHorizontais({
  itens,
  maximo,
  rotulo,
}: {
  itens: ItemBarra[];
  maximo?: number;
  rotulo: string;
}) {
  const { mostrar, esconder, balao } = useDica();
  const max = maximo ?? Math.max(...itens.map((i) => Math.abs(i.valor)), 0);
  if (!itens.length) return <p className="adm-mute">Sem dados no período.</p>;
  return (
    <div className="graf" role="list" aria-label={rotulo}>
      {itens.map((i) => {
        const pct = max > 0 ? Math.max(0, (Math.abs(i.valor) / max) * 100) : 0;
        return (
          <div
            key={i.rotulo}
            className="graf-linha"
            role="listitem"
            tabIndex={0}
            aria-label={`${i.rotulo}: ${i.texto}${i.detalhe ? `, ${i.detalhe}` : ""}`}
            onPointerMove={mostrar(i.rotulo, i.texto, i.detalhe)}
            onPointerLeave={esconder}
            onFocus={mostrar(i.rotulo, i.texto, i.detalhe)}
            onBlur={esconder}
          >
            <span className="graf-rotulo">{i.rotulo}</span>
            <span className="graf-trilho">
              <span className="graf-barra" style={{ width: `${pct}%`, background: COR[i.cor ?? "azul"] }} />
              <span className="graf-valor">{i.texto}</span>
            </span>
          </div>
        );
      })}
      {balao}
    </div>
  );
}

export type Coluna = { rotulo: string; valor: number; texto: string; detalhe?: string };

/** Colunas no tempo (um ponto por fim de semana), com eixo de valores e destaque no maior. */
export function Colunas({ pontos, rotulo }: { pontos: Coluna[]; rotulo: string }) {
  const { mostrar, esconder, balao } = useDica();
  if (!pontos.length) return <p className="adm-mute">Sem vendas no período.</p>;
  const maior = Math.max(...pontos.map((p) => p.valor), 0);
  const topo = escalaRedonda(maior);
  const marcas = [0, topo / 2, topo];
  const iMaior = pontos.findIndex((p) => p.valor === maior);
  return (
    <div className="graf graf-colunas" role="list" aria-label={rotulo}>
      <div className="graf-eixo" aria-hidden="true">
        {marcas
          .slice()
          .reverse()
          .map((m) => (
            <span key={m}>{reaisCurto(m)}</span>
          ))}
      </div>
      <div className="graf-area">
        {marcas.map((m) => (
          <span key={m} className="graf-grade" style={{ bottom: `${topo ? (m / topo) * 100 : 0}%` }} />
        ))}
        <div className="graf-cols">
          {pontos.map((p, n) => (
            <div
              key={p.rotulo + n}
              className="graf-col"
              role="listitem"
              tabIndex={0}
              aria-label={`${p.rotulo}: ${p.texto}${p.detalhe ? `, ${p.detalhe}` : ""}`}
              onPointerMove={mostrar(p.rotulo, p.texto, p.detalhe)}
              onPointerLeave={esconder}
              onFocus={mostrar(p.rotulo, p.texto, p.detalhe)}
              onBlur={esconder}
            >
              <span className="graf-col-alto">
                {n === iMaior && maior > 0 && <span className="graf-col-valor">{p.texto}</span>}
                <span
                  className="graf-col-barra"
                  style={{ height: `${topo ? (p.valor / topo) * 100 : 0}%` }}
                />
              </span>
              <span className="graf-col-rotulo">{p.rotulo}</span>
            </div>
          ))}
        </div>
      </div>
      {balao}
    </div>
  );
}

/** Valor do eixo em reais: "R$ 0", "R$ 250", "R$ 1,5 mil". */
const reaisCurto = (v: number) =>
  v >= 1000
    ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
    : `R$ ${Math.round(v)}`;

/** 0 → 0; 437 → 500; 1830 → 2000: topo "redondo" para o eixo. */
function escalaRedonda(v: number) {
  if (v <= 0) return 1;
  const ordem = 10 ** Math.floor(Math.log10(v));
  for (const passo of [1, 2, 2.5, 5, 10]) if (passo * ordem >= v) return passo * ordem;
  return 10 * ordem;
}

export type Parte = { rotulo: string; valor: number; texto: string; cor: Cor };

/** Uma barra dividida (parte do todo), com legenda abaixo: cor, nome, valor e porcentagem. */
export function BarraComposicao({ partes, rotulo }: { partes: Parte[]; rotulo: string }) {
  const { mostrar, esconder, balao } = useDica();
  const total = partes.reduce((s, p) => s + Math.max(0, p.valor), 0);
  if (!total) return <p className="adm-mute">Sem vendas no período.</p>;
  const pct = (v: number) => `${((v / total) * 100).toFixed(0)}%`;
  return (
    <div className="graf" aria-label={rotulo} role="group">
      <div className="graf-pilha">
        {partes
          .filter((p) => p.valor > 0)
          .map((p) => (
            <span
              key={p.rotulo}
              className="graf-segmento"
              tabIndex={0}
              aria-label={`${p.rotulo}: ${p.texto} (${pct(p.valor)})`}
              style={{ flexGrow: p.valor, background: COR[p.cor] }}
              onPointerMove={mostrar(p.rotulo, p.texto, pct(p.valor))}
              onPointerLeave={esconder}
              onFocus={mostrar(p.rotulo, p.texto, pct(p.valor))}
              onBlur={esconder}
            />
          ))}
      </div>
      <ul className="graf-legenda">
        {partes.map((p) => (
          <li key={p.rotulo}>
            <span className="graf-chave" style={{ background: COR[p.cor] }} aria-hidden="true" />
            <span>{p.rotulo}</span>
            <b>{p.texto}</b>
            <span className="adm-mute">{pct(Math.max(0, p.valor))}</span>
          </li>
        ))}
      </ul>
      {balao}
    </div>
  );
}
