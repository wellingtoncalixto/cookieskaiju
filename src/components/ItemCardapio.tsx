import Image from "next/image";
import Link from "next/link";
import { BotaoAdicionar } from "@/components/Cardapio";
import type { Produto } from "@/config/loja";
import { imagemProduto } from "@/lib/catalogo";
import { brl } from "@/lib/formato";

export function ItemCardapio({ produto: p }: { produto: Produto }) {
  return (
    <li className={`item${p.disponivel ? "" : " off"}`}>
      <Link href={`/cookies/${p.slug}`} scroll={false}>
        <span className="txt">
          <h3>{p.nome}</h3>
          <span className="flavor">{p.destaque}</span>
          <span className="desc">{p.descricao}</span>
          <span className="price tnum">
            {brl(p.preco)}
            {!p.disponivel && <span className="sr-only"> (esgotado)</span>}
          </span>
        </span>
        <span className="ph">
          <Image src={imagemProduto(p)} alt={p.alt} width={116} height={116} sizes="116px" />
          {!p.disponivel && (
            <span className="sold" aria-hidden="true">
              Esgotado
            </span>
          )}
        </span>
      </Link>
      <BotaoAdicionar produto={{ slug: p.slug, nome: p.nome, disponivel: p.disponivel }} />
    </li>
  );
}
