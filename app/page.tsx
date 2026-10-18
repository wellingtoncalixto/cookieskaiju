import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/Basicos";
import { Capa } from "@/components/Capa";
import { BarraSacola, ContadorSacola } from "@/components/Cardapio";
import { FaixaPromo } from "@/components/FaixaPromo";
import { ItemCardapio } from "@/components/ItemCardapio";
import { Rodape } from "@/components/Moldura";
import { ResumoSacola } from "@/components/ResumoSacola";
import { StatusAgenda } from "@/components/StatusAgenda";
import { loja, menorPreco } from "@/config/loja";
import { brl } from "@/lib/formato";
import { HORARIO_FUNCIONAMENTO } from "@/lib/agenda";
import { promoVigente } from "@/lib/frete";
import { jsonLdSite } from "@/lib/seo";
import { agoraSaoPaulo, isoData } from "@/lib/tempo";
import avatar from "../public/brand/mascote-logo.jpg";

export const metadata: Metadata = {
  title: { absolute: "Cookies Kaiju | Cookies artesanais em Mogi Mirim e Mogi Guaçu" },
  description:
    "Cookies recheados de 120 g feitos em Mogi Mirim: Explosão de Nutella, Ninho Black, Duplo Maltine e Kinder. Peça pelo site e receba no fim de semana.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <div className="com-barra">
      <JsonLd dados={jsonLdSite()} />
      <Capa />

      <div className="wrap">
        <div className="store">
          <div className="avatar">
            <Image
              src={avatar}
              alt="Logo da Cookies Kaiju com o mascote"
              width={76}
              height={76}
              sizes="76px"
            />
          </div>
          <div>
            <h1>Cookies Kaiju</h1>
            <div className="sub">{loja.descricaoCurta}</div>
          </div>
          <Link className="linkbtn" href="/como-funciona">
            Ver mais
          </Link>
        </div>

        <StatusAgenda />
        <FaixaPromo vigenteNoBuild={promoVigente(isoData(agoraSaoPaulo()))} />

        <ul className="facts" aria-label="Informações da loja">
          <li className="fact">
            <span className="k">Entregas</span>
            <span className="v">Sáb e dom</span>
          </li>
          <li className="fact">
            <span className="k">Horário</span>
            <span className="v">{HORARIO_FUNCIONAMENTO}</span>
          </li>
          <li className="fact">
            <span className="k">Cookies</span>
            <span className="v">a partir de {brl(menorPreco())}</span>
          </li>
          <li className="fact">
            <span className="k">Taxa de entrega</span>
            <span className="v">a partir de {brl(loja.frete.base)}</span>
          </li>
          <li className="fact">
            <span className="k">Pagamento</span>
            <span className="v">Pix, cartão ou dinheiro</span>
          </li>
        </ul>

        <div className="shop">
          <main id="conteudo">
            <section className="cat" id="cardapio" aria-labelledby="titulo-cardapio">
              <div className="cat-head">
                <h2 id="titulo-cardapio">Cookies</h2>
                <span className="label">Todos com {loja.pesoGramas} g</span>
              </div>
              <ul className="items">
                {loja.produtos.map((p) => (
                  <ItemCardapio key={p.slug} produto={p} />
                ))}
              </ul>
            </section>

            <section className="prose home-texto" aria-labelledby="titulo-sobre">
              <h2 id="titulo-sobre">Cookies artesanais em Mogi Mirim</h2>
              <p>
                A Cookies Kaiju faz cookies recheados de {loja.pesoGramas} g, grandes de verdade, assados em
                pequenos lotes em Mogi Mirim/SP. São quatro sabores: Explosão de Nutella, Ninho Black, Duplo
                Maltine e Kinder, a partir de {brl(menorPreco())}.
              </p>
              <p>
                Funcionamos aos sábados e domingos, das {HORARIO_FUNCIONAMENTO}, com delivery em Mogi Mirim e
                Mogi Guaçu. Dá para pedir a qualquer hora: para hoje, a entrega chega em 60 a 90 minutos; para
                outro dia, você agenda o pedido para o horário que preferir.
              </p>
              <p>
                Monte a sacola aqui no site e envie o pedido pelo WhatsApp. O pagamento é na entrega, por Pix,
                cartão por aproximação ou dinheiro. Veja <Link href="/como-funciona">como funciona</Link> e a{" "}
                <Link href="/entrega">taxa de entrega</Link> para o seu bairro.
              </p>
            </section>
          </main>

          <aside className="side" aria-labelledby="titulo-sacola">
            <div className="panel">
              <div className="panel-head">
                <h2 id="titulo-sacola">Sua sacola</h2>
                <ContadorSacola />
              </div>
              <ResumoSacola variante="lateral" />
            </div>
          </aside>
        </div>
      </div>

      <Rodape />
      <BarraSacola />
    </div>
  );
}
