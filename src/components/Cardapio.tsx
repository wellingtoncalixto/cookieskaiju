"use client";

import Link from "next/link";
import type { Produto } from "@/config/loja";
import { maximoNaSacola } from "@/lib/catalogo";
import { brl } from "@/lib/formato";
import { quantidadeTotal, subtotalSacola, useSacola } from "@/store/sacola";

/** "+" redondo sobre a foto; depois do primeiro item vira o contador "− 2 +". */
export function BotaoAdicionar({
  produto,
}: {
  produto: Pick<Produto, "slug" | "nome" | "disponivel" | "estoque">;
}) {
  const q = useSacola((s) => s.itens[produto.slug] ?? 0);
  const somar = useSacola((s) => s.somar);

  if (!q) {
    if (!produto.disponivel) return null;
    return (
      <div className="quick">
        <button
          type="button"
          className="plus"
          aria-label={`Adicionar ${produto.nome} à sacola`}
          onClick={() => somar(produto.slug, 1)}
        >
          +
        </button>
      </div>
    );
  }

  return (
    <div className="quick">
      <span className="stepper" role="group" aria-label={`Quantidade de ${produto.nome}`}>
        <button
          type="button"
          aria-label={`Remover um ${produto.nome}`}
          onClick={() => somar(produto.slug, -1)}
        >
          −
        </button>
        <output className="tnum" aria-live="polite">
          {q}
        </output>
        <button
          type="button"
          aria-label={`Adicionar mais um ${produto.nome}`}
          disabled={!produto.disponivel || q >= maximoNaSacola(produto)}
          onClick={() => somar(produto.slug, 1)}
        >
          +
        </button>
      </span>
    </div>
  );
}

/** Barra fixa "Ver sacola" no celular. Some no desktop (≥ 980 px), onde há a sacola lateral. */
export function BarraSacola() {
  const itens = useSacola((s) => s.itens);
  const q = quantidadeTotal(itens);
  if (!q) return null;
  return (
    <div className="bottom menu-only">
      <div className="in">
        <Link className="btn btn-primary btn-wide bagbar" href="/sacola">
          <span className="n tnum" aria-hidden="true">
            {q}
          </span>
          <span>Ver sacola</span>
          <span className="tnum" aria-live="polite">
            <span className="sr-only">
              {q} {q === 1 ? "cookie" : "cookies"}, total{" "}
            </span>
            {brl(subtotalSacola(itens))}
          </span>
        </Link>
      </div>
    </div>
  );
}

export function ContadorSacola() {
  const q = useSacola((s) => quantidadeTotal(s.itens));
  return (
    <span className="label" aria-live="polite">
      {q ? `${q} cookie${q > 1 ? "s" : ""}` : ""}
    </span>
  );
}
