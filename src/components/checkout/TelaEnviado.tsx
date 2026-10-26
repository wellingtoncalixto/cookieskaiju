"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Carregando } from "@/components/checkout/Comum";
import { IconeWhatsApp } from "@/components/Icones";
import { loja } from "@/config/loja";
import { useCheckout, useGuardaEtapa } from "@/hooks/useCheckout";
import { linkWhatsApp } from "@/lib/mensagem";
import { usePedido } from "@/store/pedido";
import { useSacola } from "@/store/sacola";
import mascoteFeliz from "../../../public/brand/mascote-feliz.png";

export function TelaEnviado() {
  const router = useRouter();
  const c = useCheckout();
  const liberada = useGuardaEtapa("enviado", c);
  const mensagem = c.pedido.mensagemEnviada ?? "";
  const [copiado, setCopiado] = useState("Copiar mensagem");
  const pre = useRef<HTMLPreElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!liberada) return;
    titulo.current?.focus({ preventScroll: true });
    // Pedido concluído: a sacola começa vazia na próxima visita. A mensagem continua disponível
    // aqui (em memória) para copiar ou reabrir o WhatsApp.
    useSacola.getState().limpar();
  }, [liberada]);

  if (!liberada) return <Carregando />;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado("Mensagem copiada");
    } catch {
      // Sem acesso à área de transferência: seleciona o texto para o cliente copiar.
      const r = document.createRange();
      r.selectNodeContents(pre.current!);
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
      setCopiado("Texto selecionado, use copiar");
    }
    setTimeout(() => setCopiado("Copiar mensagem"), 2400);
  }

  function novoPedido() {
    useSacola.getState().limpar();
    usePedido.getState().limpar();
    router.replace("/");
  }

  return (
    <main id="conteudo" className="col screen enviado">
      <div className="done">
        <Image src={mascoteFeliz} alt="Mascote da Cookies Kaiju feliz" width={150} />
        <h1 ref={titulo} tabIndex={-1}>
          Quase lá
        </h1>
        <p>
          O WhatsApp abriu em outra aba com a mensagem do pedido pronta. Toque em enviar por lá para concluir.
        </p>
        <SituacaoRegistro id={c.pedido.idPedido} registro={c.pedido.registro} />
        <p className="fine">
          Se o WhatsApp não abriu, copie a mensagem e envie para{" "}
          <span className="copy-num">{loja.contato.whatsappExibicao}</span>.
        </p>
        <pre className="msg" ref={pre}>
          {mensagem}
        </pre>
        <div className="acts">
          <a
            className="btn btn-primary btn-wide"
            href={linkWhatsApp(mensagem)}
            target="_blank"
            rel="noopener"
          >
            <IconeWhatsApp />
            Abrir o WhatsApp de novo
          </a>
          <button className="btn btn-ghost btn-wide" type="button" onClick={copiar} aria-live="polite">
            {copiado}
          </button>
          <button className="btn btn-ghost btn-wide" type="button" onClick={novoPedido}>
            Fazer outro pedido
          </button>
        </div>
      </div>
    </main>
  );
}

/**
 * Situação do registro no painel da loja. Só diz "registrado" depois da confirmação do servidor;
 * em caso de falha, não fala de registro (o pedido segue pelo WhatsApp, com o código na mensagem).
 */
function SituacaoRegistro({ id, registro }: { id: string | null; registro: string }) {
  if (!id || registro === "inativo") return null;
  return (
    <p className={`fine registro ${registro}`} role="status">
      {registro === "registrado"
        ? `Pedido ${id} recebido pelo site. A confirmação vem pelo WhatsApp.`
        : registro === "enviando"
          ? `Pedido ${id}`
          : `Código do pedido: ${id} (já está na mensagem).`}
    </p>
  );
}
