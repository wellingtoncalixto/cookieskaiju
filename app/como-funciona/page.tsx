import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/Basicos";
import { CabecalhoSite, Rodape } from "@/components/Moldura";
import { loja, menorPreco } from "@/config/loja";
import { brl } from "@/lib/formato";
import { jsonLdFaq } from "@/lib/seo";
import { DIAS_CURTOS } from "@/lib/tempo";

export const metadata: Metadata = {
  title: "Como funciona o pedido",
  description:
    "Agenda de quarta a sexta, entregas no sábado e domingo das 13h às 15h ou das 18h às 20h, pronta-entrega no fim de semana e pagamento por Pix, cartão ou dinheiro.",
  alternates: { canonical: "/como-funciona" },
};

const janelasTexto = loja.janelas.map((j) => `das ${j.nome}`).join(" ou ");

const perguntas = [
  {
    pergunta: "Quando posso fazer o pedido?",
    resposta:
      "A agenda de pedidos abre na quarta-feira às 9h e fecha na sexta-feira às 12h. Os pedidos feitos nesse período são entregues no sábado e no domingo seguintes.",
  },
  {
    pergunta: "Quais são os horários de entrega?",
    resposta: `As entregas são no sábado e no domingo, ${janelasTexto}. Você escolhe o dia e a janela ao finalizar o pedido.`,
  },
  {
    pergunta: "Tem pronta-entrega?",
    resposta:
      "Sim. No sábado e no domingo, a partir das 8h, aceitamos pedidos de pronta-entrega enquanto houver estoque, para janelas que começam daqui a pelo menos uma hora.",
  },
  {
    pergunta: "Como eu pago?",
    resposta:
      "O pagamento é feito na entrega: Pix (a chave vai na confirmação), cartão de crédito ou débito por aproximação, ou dinheiro. O site não faz cobranças.",
  },
  {
    pergunta: "Quanto custa a entrega?",
    resposta: `A taxa é calculada pela distância de rota: até 3 km custa ${brl(loja.frete.base)} e, acima disso, ${brl(loja.frete.porKm)} por km adicional. A loja confere a taxa antes de confirmar.`,
  },
  {
    pergunta: "Como sei que o pedido foi confirmado?",
    resposta:
      "Ao finalizar, o site abre o WhatsApp com a mensagem do pedido pronta. Depois que você envia, a Cookies Kaiju responde confirmando o pedido, a taxa e o horário.",
  },
  {
    pergunta: "Qual o tamanho dos cookies?",
    resposta: `Todos os cookies têm ${loja.pesoGramas} g e são recheados. Os preços começam em ${brl(menorPreco())}.`,
  },
];

const semana: [number, string, string][] = [
  [1, "Sem agenda", ""],
  [2, "Sem agenda", ""],
  [3, "Abre 9h", "agenda"],
  [4, "Aberta", "agenda"],
  [5, "Fecha 12h", "agenda"],
  [6, "Entregas", "entrega"],
  [0, "Entregas", "entrega"],
];

export default function ComoFunciona() {
  return (
    <>
      <JsonLd dados={jsonLdFaq(perguntas)} />
      <CabecalhoSite atual="/como-funciona" />
      <main id="conteudo" className="wrap page">
        <div className="page-head">
          <h1 className="page-title">Como funciona</h1>
          <p className="lead">
            Você monta a sacola no site e envia o pedido pelo WhatsApp. A Cookies Kaiju confirma e entrega no
            fim de semana em Mogi Mirim e Mogi Guaçu.
          </p>
        </div>

        <section className="prose" aria-labelledby="t-agenda">
          <h2 id="t-agenda">Agenda da semana</h2>
          <ul className="week" aria-label="Agenda semanal">
            {semana.map(([d, s, c]) => (
              <li key={d} className={`day ${c}`}>
                <span className="d">{DIAS_CURTOS[d]}</span>
                <span className="s">{s}</span>
              </li>
            ))}
          </ul>
          <ul>
            <li>A agenda de pedidos abre quarta às 9h e fecha sexta às 12h.</li>
            <li>Entregas no sábado e no domingo, {janelasTexto}.</li>
            <li>No fim de semana aceitamos pedidos de pronta-entrega enquanto houver estoque.</li>
            <li>Com a agenda fechada, você pode ver o cardápio e deixar a sacola montada para depois.</li>
          </ul>
        </section>

        <section className="prose" aria-labelledby="t-passos">
          <h2 id="t-passos">Passo a passo</h2>
          <ul>
            <li>
              Escolha os cookies no <Link href="/#cardapio">cardápio</Link> e toque em “Ver sacola”.
            </li>
            <li>Informe o dia, a janela e o endereço. A taxa de entrega é calculada na hora.</li>
            <li>Preencha seu nome, WhatsApp e a forma de pagamento.</li>
            <li>Revise a comanda e toque em “Enviar pedido pelo WhatsApp”.</li>
          </ul>
        </section>

        <section className="prose" aria-labelledby="t-pagamento">
          <h2 id="t-pagamento">Formas de pagamento</h2>
          <ul>
            {loja.pagamentos.map((p) => (
              <li key={p.id}>
                <b>{p.nome}:</b> {p.descricao.toLowerCase()}.
              </li>
            ))}
          </ul>
          <p>O site não faz cobranças: o pagamento é combinado no WhatsApp e feito na entrega.</p>
        </section>

        <section className="prose faq" aria-labelledby="t-faq">
          <h2 id="t-faq">Perguntas frequentes</h2>
          <div>
            {perguntas.map((q) => (
              <details key={q.pergunta}>
                <summary>{q.pergunta}</summary>
                <p>{q.resposta}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="prose" aria-labelledby="t-contato">
          <h2 id="t-contato">Contato</h2>
          <p>
            WhatsApp{" "}
            <a href={`https://wa.me/${loja.contato.whatsapp}`} target="_blank" rel="noopener">
              {loja.contato.whatsappExibicao}
            </a>{" "}
            · Instagram{" "}
            <a href={`https://www.instagram.com/${loja.contato.instagram}`} target="_blank" rel="noopener">
              @{loja.contato.instagram}
            </a>
          </p>
          <p>
            Veja também a <Link href="/entrega">área e a taxa de entrega</Link>.
          </p>
        </section>
      </main>
      <Rodape />
    </>
  );
}
