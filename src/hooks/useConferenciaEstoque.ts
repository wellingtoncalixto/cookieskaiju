"use client";

import { useEffect, useState } from "react";

type Sabor = { slug: string; nome: string; estoque: number | null; disponivel: boolean };

/**
 * Confere a sacola com o estoque atual (lido na hora, a cada 30 s) e devolve as mensagens de erro.
 * Se a consulta falhar, não bloqueia: o pedido segue e, se faltar, a loja resolve pelo WhatsApp.
 */
export function useConferenciaEstoque(itens: Record<string, number>): string[] {
  const [sabores, setSabores] = useState<Sabor[] | null>(null);
  useEffect(() => {
    let ativo = true;
    const ler = async () => {
      try {
        const r = await fetch("/api/estoque", { cache: "no-store" });
        if (r.ok && ativo) setSabores((await r.json()) as Sabor[]);
      } catch {
        // Sem resposta: mantém a última leitura.
      }
    };
    void ler();
    const id = setInterval(ler, 30_000);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, []);
  if (!sabores) return [];
  const erros: string[] = [];
  for (const [slug, quantidade] of Object.entries(itens)) {
    const s = sabores.find((x) => x.slug === slug);
    if (!s) continue;
    if (!s.disponivel) erros.push(`${s.nome} esgotou. Tire da sacola para continuar.`);
    else if (s.estoque != null && quantidade > s.estoque)
      erros.push(
        `Só ${s.estoque === 1 ? "resta 1 unidade" : `restam ${s.estoque} unidades`} de ${s.nome}. Ajuste a sacola.`,
      );
  }
  return erros;
}
