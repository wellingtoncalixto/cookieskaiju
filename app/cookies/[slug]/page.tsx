import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/Basicos";
import { FichaProduto } from "@/components/FichaProduto";
import { CabecalhoSite, Rodape } from "@/components/Moldura";
import { imagemProduto, loja, posterProduto, produtoPorSlug } from "@/config/loja";
import { HORARIO_FUNCIONAMENTO } from "@/lib/agenda";
import { brl } from "@/lib/formato";
import { jsonLdProduto } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return loja.produtos.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = produtoPorSlug((await params).slug);
  if (!p) return {};
  const desc = `${p.descricao.replace(/\.$/, "")}. Cookie de ${loja.pesoGramas} g por ${brl(p.preco)} com entrega em Mogi Mirim e Mogi Guaçu.`;
  // A imagem de compartilhamento vem de ./opengraph-image.tsx (foto do sabor + nome + preço).
  return {
    title: `Cookie ${p.nome}`,
    description: desc,
    alternates: { canonical: `/cookies/${p.slug}` },
    openGraph: {
      type: "website",
      title: `Cookie ${p.nome} | Cookies Kaiju`,
      description: desc,
      url: `/cookies/${p.slug}`,
    },
  };
}

export default async function PaginaCookie({ params }: Props) {
  const p = produtoPorSlug((await params).slug);
  if (!p) notFound();
  const outros = loja.produtos.filter((o) => o.slug !== p.slug);

  return (
    <>
      <JsonLd dados={jsonLdProduto(p)} />
      <CabecalhoSite />
      <main id="conteudo" className="wrap page">
        <nav className="crumbs" aria-label="Você está em">
          <ol>
            <li>
              <Link href="/">Início</Link>
            </li>
            <li>
              <Link href="/#cardapio">Cookies</Link>
            </li>
            <li aria-current="page">{p.nome}</li>
          </ol>
        </nav>

        <article className="product">
          <div className="ficha">
            <FichaProduto produto={p} variante="pagina" />
          </div>
          <div className="prose">
            <h2>Sobre o cookie {p.nome}</h2>
            <p>
              {p.descricao} Todo cookie da Cookies Kaiju tem {loja.pesoGramas} g e sai do forno em pequenos
              lotes em Mogi Mirim, para chegar macio por dentro e com bastante recheio.
            </p>
            <p>
              Peça pelo site a qualquer hora e receba no sábado ou no domingo, das {HORARIO_FUNCIONAMENTO}:
              para agora, com a loja aberta, ou agendado. Entregamos em Mogi Mirim e Mogi Guaçu, com taxa a
              partir de {brl(loja.frete.base)}. Veja os detalhes na página de{" "}
              <Link href="/entrega">entrega</Link>.
            </p>
            <figure className="poster">
              <Image
                src={posterProduto(p.slug)}
                alt={`Cartaz do cookie ${p.nome} da Cookies Kaiju`}
                width={1024}
                height={1536}
                sizes="(max-width: 860px) 92vw, 420px"
              />
            </figure>
          </div>
        </article>

        <section className="others-sec" aria-labelledby="titulo-outros">
          <h2 id="titulo-outros">Outros sabores</h2>
          <ul className="others">
            {outros.map((o) => (
              <li key={o.slug}>
                <Link href={`/cookies/${o.slug}`}>
                  <Image
                    src={imagemProduto(o.slug)}
                    alt={o.alt}
                    width={240}
                    height={240}
                    sizes="(max-width: 560px) 45vw, 240px"
                  />
                  <b>{o.nome}</b>
                  <span>
                    {o.destaque} · {brl(o.preco)}
                    {!o.disponivel && " · Esgotado"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Rodape />
    </>
  );
}
