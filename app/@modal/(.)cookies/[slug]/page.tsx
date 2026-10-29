import { notFound } from "next/navigation";
import { FichaProduto } from "@/components/FichaProduto";
import { Modal } from "@/components/Modal";
import { produtoPorSlug } from "@/lib/catalogo";
import { obterCatalogo } from "@/server/catalogo";

export async function generateStaticParams() {
  return (await obterCatalogo()).map((p) => ({ slug: p.slug }));
}

/** Ficha aberta por cima do cardápio (navegação interna). Acesso direto cai em /cookies/[slug]. */
export default async function FichaModal({ params }: { params: Promise<{ slug: string }> }) {
  const p = produtoPorSlug((await params).slug, await obterCatalogo());
  if (!p) notFound();
  return (
    <Modal rotulo={`${p.nome}, ${p.destaque}`}>
      <FichaProduto produto={p} variante="modal" />
    </Modal>
  );
}
