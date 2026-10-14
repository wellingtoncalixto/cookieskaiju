"use client";

import { useEffect } from "react";
import { useSacola } from "@/store/sacola";

/** Lê a sacola do localStorage depois da hidratação (a home é estática). */
export function HidratarSacola() {
  useEffect(() => {
    void useSacola.persist.rehydrate();
    // Apaga chaves de versões antigas do protótipo, que guardavam dados pessoais.
    try {
      ["ck_form", "ck_slot", "ck_pay", "ck_cart"].forEach((k) => localStorage.removeItem(k));
    } catch {}
  }, []);
  return null;
}
