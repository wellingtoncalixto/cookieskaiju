"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { IconeFechar } from "@/components/Icones";

const FOCAVEIS = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet no celular e diálogo centralizado no desktop.
 * Fecha com o "voltar" (do navegador/Android), com Esc, no X e tocando fora.
 */
export function Modal({ children, rotulo }: { children: React.ReactNode; rotulo: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    html.setAttribute("data-modal-aberto", "");
    ref.current?.querySelector<HTMLElement>(".p-foot .btn")?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
      if (e.key !== "Tab" || !ref.current) return;
      // Mantém o foco dentro do diálogo.
      const focaveis = ref.current.querySelectorAll<HTMLElement>(FOCAVEIS);
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo?.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      html.removeAttribute("data-modal-aberto");
      anterior?.focus?.({ preventScroll: true });
    };
  }, [router]);

  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={rotulo}>
        <button className="iconbtn x" type="button" aria-label="Fechar" onClick={() => router.back()}>
          <IconeFechar />
        </button>
        {children}
      </div>
    </div>
  );
}
