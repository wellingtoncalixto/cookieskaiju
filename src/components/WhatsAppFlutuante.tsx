"use client";

import { usePathname } from "next/navigation";
import { IconeWhatsApp } from "@/components/Icones";
import { loja } from "@/config/loja";
import { linkWhatsApp } from "@/lib/mensagem";

const MENSAGEM = "Olá! Vim pelo site da Cookies Kaiju e tenho uma dúvida.";

/**
 * Botão flutuante para falar com a loja pelo WhatsApp.
 * Não aparece no checkout (sacola e etapas do pedido), que já tem a barra de ação fixa embaixo.
 */
export function WhatsAppFlutuante() {
  const caminho = usePathname();
  if (caminho === "/sacola" || caminho.startsWith("/pedido")) return null;
  return (
    <a
      className="wa-flutuante"
      href={linkWhatsApp(MENSAGEM)}
      target="_blank"
      rel="noopener"
      aria-label={`Falar com a ${loja.nome} no WhatsApp`}
    >
      <IconeWhatsApp size={30} />
    </a>
  );
}
