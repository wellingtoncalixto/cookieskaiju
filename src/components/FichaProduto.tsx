"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { imagemProduto, loja, type Produto } from "@/config/loja";
import { brl } from "@/lib/formato";
import { useSacola } from "@/store/sacola";

type Props = { produto: Produto; variante: "modal" | "pagina" };

/** Ficha do produto: foto, descrição, quantidade e botão de adicionar/atualizar. */
export function FichaProduto({ produto: p, variante }: Props) {
  const router = useRouter();
  const naSacola = useSacola((s) => s.itens[p.slug] ?? 0);
  const definir = useSacola((s) => s.definir);
  const [qtdEditada, setQtd] = useState<number | null>(null);
  const [aviso, setAviso] = useState("");
  const qtd = qtdEditada ?? (naSacola || 1);

  const bloqueado = !p.disponivel && !naSacola;
  const Titulo = variante === "modal" ? "h2" : "h1";

  let texto = naSacola ? "Atualizar sacola" : "Adicionar";
  if (bloqueado) texto = "Esgotado";
  else if (naSacola && qtd === 0) texto = "Remover da sacola";

  function confirmar() {
    if (bloqueado) return;
    definir(p.slug, qtd);
    setQtd(null);
    if (variante === "modal") router.back();
    else setAviso(qtd ? `${qtd} × ${p.nome} na sacola.` : `${p.nome} removido da sacola.`);
  }

  return (
    <>
      <div className="p-photo">
        <Image
          src={imagemProduto(p.slug)}
          alt={p.alt}
          fill
          sizes={variante === "modal" ? "(max-width: 560px) 100vw, 560px" : "(max-width: 860px) 100vw, 540px"}
          preload={variante === "pagina"}
        />
        {!p.disponivel && <span className="sold sold-ficha">Esgotado</span>}
      </div>
      <div className="p-body">
        <Titulo>{p.nome}</Titulo>
        <div className="flavor">{p.destaque}</div>
        <p>{p.descricao}</p>
        <ul className="meta">
          <li>{loja.pesoGramas} g</li>
          <li className="tnum">{brl(p.preco)}</li>
        </ul>
      </div>
      <div className="p-foot">
        <span className="stepper" role="group" aria-label="Quantidade">
          <button
            type="button"
            aria-label="Diminuir"
            disabled={qtd <= (naSacola ? 0 : 1)}
            onClick={() => setQtd(Math.max(0, qtd - 1))}
          >
            −
          </button>
          <output className="tnum" aria-live="polite">
            {qtd}
          </output>
          <button
            type="button"
            aria-label="Aumentar"
            disabled={!p.disponivel}
            onClick={() => setQtd(qtd + 1)}
          >
            +
          </button>
        </span>
        <button
          className="btn btn-primary btn-row"
          type="button"
          aria-disabled={bloqueado}
          onClick={confirmar}
        >
          <span>{texto}</span>
          {!bloqueado && qtd > 0 && <span className="tnum">{brl(qtd * p.preco)}</span>}
        </button>
      </div>
      {variante === "pagina" && (
        <p className="fmsg ok aviso-ficha" role="status">
          {aviso}{" "}
          {aviso && naSacola > 0 && (
            <Link className="linkbtn" href="/sacola">
              Ver sacola
            </Link>
          )}
        </p>
      )}
    </>
  );
}
