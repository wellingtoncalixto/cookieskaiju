"use client";

import Image from "next/image";
import Link from "next/link";
import { imagemProduto } from "@/config/loja";
import { useAgenda } from "@/hooks/useAgenda";
import { useResumoPedido } from "@/hooks/useResumoPedido";
import { brl } from "@/lib/formato";
import { textosTaxa } from "@/lib/frete";
import { linhasSacola, useSacola } from "@/store/sacola";
import mascoteFome from "../../public/brand/mascote-com-fome.png";

/** Itens, quantidades e totais da sacola. `lateral` = painel do desktop; `pagina` = /sacola. */
export function ResumoSacola({ variante }: { variante: "lateral" | "pagina" }) {
  const itens = useSacola((s) => s.itens);
  const somar = useSacola((s) => s.somar);
  const situacao = useAgenda();
  const r = useResumoPedido(situacao?.agenda ?? null);
  const linhas = linhasSacola(itens);

  if (!linhas.length) {
    return (
      <div className="empty">
        <Image src={mascoteFome} alt="Mascote da Cookies Kaiju com fome" width={110} />
        <p>
          <b>Sua sacola está vazia.</b>
        </p>
        <p>O kaiju está com fome. Escolha seus cookies no cardápio.</p>
        {variante === "pagina" && (
          <Link className="linkbtn" href="/">
            Ver cardápio
          </Link>
        )}
      </div>
    );
  }

  const taxa = textosTaxa(r.taxa);
  return (
    <>
      <ul className="bag-lines">
        {linhas.map(({ produto: p, quantidade }) => (
          <li key={p.slug}>
            <span className="ph">
              <Image src={imagemProduto(p.slug)} alt="" width={56} height={56} sizes="56px" />
            </span>
            <span className="nm">
              <b>{p.nome}</b>
              <small>{p.destaque}</small>
              <span className="v tnum">{brl(quantidade * p.preco)}</span>
            </span>
            <span className="stepper" role="group" aria-label={`Quantidade de ${p.nome}`}>
              <button type="button" aria-label={`Remover um ${p.nome}`} onClick={() => somar(p.slug, -1)}>
                −
              </button>
              <output className="tnum">{quantidade}</output>
              <button
                type="button"
                aria-label={`Adicionar um ${p.nome}`}
                disabled={!p.disponivel}
                onClick={() => somar(p.slug, 1)}
              >
                +
              </button>
            </span>
          </li>
        ))}
      </ul>
      {variante === "pagina" && (
        <div className="center-link">
          <Link className="linkbtn" href="/">
            Adicionar mais itens
          </Link>
        </div>
      )}
      <div className="sum" aria-live="polite">
        <div className="r">
          <span>Subtotal</span>
          <span className="tnum">{brl(r.subtotal)}</span>
        </div>
        <div className="r">
          <span>Taxa de entrega</span>
          <span>{taxa.curto}</span>
        </div>
        {r.taxa.tipo === "gratis" ? (
          <div className="note hl">{taxa.detalhe}</div>
        ) : (
          r.dica && <div className="note hl">{r.dica}</div>
        )}
        <div className="r total">
          <span>Total</span>
          <span className="tnum">{brl(r.total)}</span>
        </div>
      </div>
      {variante === "lateral" && (
        <Link className="btn btn-primary btn-wide mt-14" href="/pedido/entrega">
          Continuar
        </Link>
      )}
    </>
  );
}
