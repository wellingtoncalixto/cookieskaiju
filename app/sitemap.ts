import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/loja";
import { obterCatalogo } from "@/server/catalogo";

/** Data da última alteração de conteúdo (atualize ao mudar o cardápio ou os textos). */
const ATUALIZADO_EM = new Date("2026-10-14");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const produtos = await obterCatalogo();
  const url = (p: string) => `${SITE_URL}${p}`;
  return [
    { url: url("/"), lastModified: ATUALIZADO_EM, changeFrequency: "weekly", priority: 1 },
    ...produtos.map((p) => ({
      url: url(`/cookies/${p.slug}`),
      lastModified: ATUALIZADO_EM,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    { url: url("/como-funciona"), lastModified: ATUALIZADO_EM, changeFrequency: "monthly", priority: 0.6 },
    { url: url("/entrega"), lastModified: ATUALIZADO_EM, changeFrequency: "monthly", priority: 0.7 },
    { url: url("/privacidade"), lastModified: ATUALIZADO_EM, changeFrequency: "yearly", priority: 0.3 },
  ];
}
