import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoSite, Rodape } from "@/components/Moldura";
import { loja } from "@/config/loja";
import { brl } from "@/lib/formato";
import { promoVigente, valorFrete } from "@/lib/frete";
import { agoraSaoPaulo, isoData } from "@/lib/tempo";

export const metadata: Metadata = {
  title: "Entrega de cookies em Mogi Mirim e Mogi Guaçu",
  description:
    "Entregamos cookies aos sábados e domingos, das 13h às 15h ou das 18h às 20h, em Mogi Mirim e Mogi Guaçu. Taxa a partir de R$ 3,00 e frete grátis na promoção.",
  alternates: { canonical: "/entrega" },
};

export default function Entrega() {
  const [ano, mes, dia] = loja.promo.ate.split("-");
  const kms = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <>
      <CabecalhoSite atual="/entrega" />
      <main id="conteudo" className="wrap page">
        <div className="page-head">
          <h1 className="page-title">Entrega em Mogi Mirim e Mogi Guaçu</h1>
          <p className="lead">
            Os cookies artesanais da Cookies Kaiju saem de Mogi Mirim e chegam até você aos sábados e
            domingos. Atendemos Mogi Mirim e Mogi Guaçu, com taxa calculada pela distância real de rota.
          </p>
        </div>

        <section className="prose" aria-labelledby="t-janelas">
          <h2 id="t-janelas">Dias e horários</h2>
          <ul>
            {loja.janelas.map((j) => (
              <li key={j.id}>Sábado e domingo, das {j.nome}.</li>
            ))}
            <li>Pedidos com agendamento de quarta às 9h até sexta às 12h.</li>
            <li>No fim de semana, pronta-entrega a partir das 8h, conforme o estoque.</li>
          </ul>
        </section>

        <section className="prose" aria-labelledby="t-taxa">
          <h2 id="t-taxa">Taxa de entrega</h2>
          <p>
            A taxa é calculada pela distância de rota de carro ou moto até o seu endereço. Primeiro a
            distância é arredondada para uma casa decimal, como no Google Maps, e depois sempre para o km
            inteiro seguinte.
          </p>
          <ul>
            <li>
              Até {loja.frete.kmInclusos} km: {brl(loja.frete.base)}.
            </li>
            <li>
              Acima de {loja.frete.kmInclusos} km: {brl(loja.frete.base)} + {brl(loja.frete.porKm)} por km
              adicional. Exemplo: 4,2 km conta como 5 km e sai {brl(valorFrete(5))}.
            </li>
            <li>Uma taxa por endereço de entrega.</li>
          </ul>
          <dl className="ktable" aria-label="Tabela de taxa por distância">
            {kms.map((km) => (
              <div key={km} className={`kc${km <= loja.frete.kmInclusos ? " base" : ""}`}>
                <dt>{km} km</dt>
                <dd className="tnum">{brl(valorFrete(km))}</dd>
              </div>
            ))}
          </dl>
          <p>
            O valor aparece na hora, durante o pedido. Se a rota não puder ser calculada, a loja confirma a
            taxa no WhatsApp antes de fechar o pedido.
          </p>
        </section>

        {promoVigente(isoData(agoraSaoPaulo())) && (
          <section className="prose" aria-labelledby="t-promo">
            <h2 id="t-promo">Promoção de lançamento</h2>
            <p>
              Para entregas até {dia}/{mes}/{ano}, a entrega é grátis em pedidos a partir de{" "}
              {loja.promo.cidades.map((c) => `${c.min} cookies em ${c.nome}`).join(" e ")}. Abaixo disso, vale
              a tabela normal.
            </p>
          </section>
        )}

        <section className="prose" aria-labelledby="t-cookies">
          <h2 id="t-cookies">Cookies recheados com entrega no fim de semana</h2>
          <p>
            São quatro sabores de cookies recheados de {loja.pesoGramas} g:{" "}
            {loja.produtos.map((p, i) => (
              <span key={p.slug}>
                <Link href={`/cookies/${p.slug}`}>{p.nome}</Link>
                {i < loja.produtos.length - 2 ? ", " : i === loja.produtos.length - 2 ? " e " : "."}
              </span>
            ))}{" "}
            Monte a sacola no <Link href="/#cardapio">cardápio</Link> e envie o pedido pelo WhatsApp.
          </p>
        </section>
      </main>
      <Rodape />
    </>
  );
}
