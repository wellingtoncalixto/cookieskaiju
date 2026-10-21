"use client";

import { useEffect } from "react";
import { REGISTRO_PEDIDOS_ATIVO } from "@/config/planilha";
import { processarFila } from "@/lib/registro-cliente";
import { useSacola } from "@/store/sacola";

/** Lê a sacola do localStorage depois da hidratação (a home é estática). */
export function HidratarSacola() {
  useEffect(() => {
    void useSacola.persist.rehydrate();
    // Reenvia resumos de pedido que ficaram pendentes numa visita anterior (até 24h; depois, descarta).
    if (REGISTRO_PEDIDOS_ATIVO) setTimeout(() => void processarFila(), 3000);
    else
      try {
        localStorage.removeItem("ck_registros");
      } catch {}
    // Apaga chaves de versões antigas do protótipo, que guardavam dados pessoais.
    try {
      ["ck_form", "ck_slot", "ck_pay", "ck_cart"].forEach((k) => localStorage.removeItem(k));
    } catch {}
  }, []);
  return null;
}
