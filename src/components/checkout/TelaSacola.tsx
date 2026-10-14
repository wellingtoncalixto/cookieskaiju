"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CabecalhoEtapa, ListaErros } from "@/components/checkout/Comum";
import { ResumoSacola } from "@/components/ResumoSacola";
import { brl } from "@/lib/formato";
import { quantidadeTotal, subtotalSacola, useSacola } from "@/store/sacola";

export function TelaSacola() {
  const router = useRouter();
  const itens = useSacola((s) => s.itens);
  const [tentou, setTentou] = useState(false);
  const vazia = quantidadeTotal(itens) === 0;

  return (
    <>
      <CabecalhoEtapa titulo="Sacola" subtitulo="Cookies Kaiju" voltarPara="/" />
      <main id="conteudo" className="col screen">
        <div className="block">
          <ResumoSacola variante="pagina" />
        </div>
      </main>
      <div className="actionbar">
        <div className="in">
          <ListaErros visivel={tentou} mensagens={vazia ? ["Sua sacola está vazia."] : []} />
          <div className="tot">
            <span>Subtotal</span>
            <b className="tnum" aria-live="polite">
              {brl(subtotalSacola(itens))}
            </b>
          </div>
          <button
            className="btn btn-primary btn-wide"
            type="button"
            onClick={() => {
              setTentou(true);
              if (!vazia) router.push("/pedido/entrega");
            }}
          >
            Continuar
          </button>
        </div>
      </div>
    </>
  );
}
