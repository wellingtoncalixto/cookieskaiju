import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/Basicos";
import { CabecalhoSite, Rodape } from "@/components/Moldura";
import { loja, menorPreco } from "@/config/loja";
import { HORARIO_FUNCIONAMENTO } from "@/lib/agenda";
import { brl } from "@/lib/formato";
import { jsonLdFaq } from "@/lib/seo";
import { DIAS_CURTOS } from "@/lib/tempo";

export const metadata: Metadata = {
  title: "Como funciona o pedido",
  description:
    "Abrimos sábado e domingo, das 13h às 18h, com delivery. Peça para agora ou agende a qualquer hora. Pagamento por Pix, cartão ou dinheiro na entrega.",
  alternates: { canonical: "/como-funciona" },
};

const perguntas = [
  {
    pergunta: "Quando posso fazer o pedido?",
    resposta: `A qualquer hora. Funcionamos aos sábados e domingos, das ${HORARIO_FUNCIONAMENTO}: com a loja aberta, você pede para agora; fora desse horário, faz o pedido do mesmo jeito e agenda o horário que preferir.`,
  },
  {
    pergunta: "Quais são os horários de entrega?",
    resposta: `As entregas são no sábado e no domingo, das ${HORARIO_FUNCIONAMENTO}. Ao finalizar, você escolhe "o quanto antes" (com a loja aberta) ou uma faixa de horário de 1 hora.`,
  },
  {
    pergunta: "Posso pedir para agora?",
    resposta:
      'Sim. Com a loja aberta, escolha "o quanto antes" e a gente entrega assim que possível. Para agendar, o horário precisa começar daqui a pelo menos uma hora.',
  },
  ...(loja.retirada.habilitada
    ? [
        {
          pergunta: "Posso retirar o pedido?",
          resposta: `Sim. Ao finalizar, escolha “Retirada”: não há taxa de entrega e a retirada é nos mesmos dias e horários das entregas. ${loja.retirada.aviso}`,
        },
      ]
    : []),
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
  [1, "Agende", ""],
  [2, "Agende", ""],
  [3, "Agende", ""],
  [4, "Agende", ""],
  [5, "Agende", ""],
  [6, HORARIO_FUNCIONAMENTO, "entrega"],
  [0, HORARIO_FUNCIONAMENTO, "entrega"],
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
          <h2 id="t-agenda">Horário de funcionamento</h2>
          <ul className="week" aria-label="Funcionamento na semana">
            {semana.map(([d, s, c]) => (
              <li key={d} className={`day ${c}`}>
                <span className="d">{DIAS_CURTOS[d]}</span>
                <span className="s">{s}</span>
              </li>
            ))}
          </ul>
          <ul>
            <li>Abrimos sábado e domingo, das {HORARIO_FUNCIONAMENTO}, com delivery.</li>
            <li>Com a loja aberta, peça para agora e receba o quanto antes.</li>
            <li>Nos outros dias e horários, faça o pedido do mesmo jeito e agende o horário que preferir.</li>
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
