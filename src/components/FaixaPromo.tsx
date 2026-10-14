"use client";

import { useEffect, useState } from "react";
import { loja } from "@/config/loja";
import { promoVigente } from "@/lib/frete";
import { agoraSaoPaulo, isoData } from "@/lib/tempo";

/**
 * Faixa laranja da promoção. O HTML estático sai com o valor do build; no cliente,
 * a data é conferida de novo e a faixa some sozinha depois da data-limite.
 */
export function FaixaPromo({ vigenteNoBuild }: { vigenteNoBuild: boolean }) {
  const [vigente, setVigente] = useState(vigenteNoBuild);
  useEffect(() => {
    const t = setTimeout(() => setVigente(promoVigente(isoData(agoraSaoPaulo()))), 0);
    return () => clearTimeout(t);
  }, []);
  if (!vigente) return null;
  const [, m, d] = loja.promo.ate.split("-");
  return (
    <p className="promo-strip">
      <b>Entrega grátis</b>
      <span>
        Pedidos com {loja.promo.cidades.map((c) => `${c.min}+ cookies em ${c.nome}`).join(" ou ")}, até {d}/
        {m}.
      </span>
    </p>
  );
}
