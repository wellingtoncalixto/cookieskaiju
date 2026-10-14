import type { Metadata } from "next";
import { CabecalhoSite, Rodape } from "@/components/Moldura";
import { loja } from "@/config/loja";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description:
    "O site da Cookies Kaiju não guarda nome, WhatsApp nem endereço. Veja como os dados do pedido são usados, quais serviços de mapa consultamos e como falar com a loja.",
  alternates: { canonical: "/privacidade" },
};

export default function Privacidade() {
  return (
    <>
      <CabecalhoSite />
      <main id="conteudo" className="wrap page">
        <div className="page-head">
          <h1 className="page-title">Privacidade</h1>
          <p className="lead">
            Resumo: o site não guarda seus dados pessoais. Eles servem só para montar a mensagem do pedido.
          </p>
        </div>

        <div className="prose">
          <h2>Quais dados você informa</h2>
          <p>
            Para fazer um pedido você informa nome, WhatsApp, endereço de entrega e, se quiser, observações.
            Esses dados ficam apenas na memória da página enquanto você preenche o pedido e são usados para
            montar a mensagem que você mesmo envia para a {loja.nome} pelo WhatsApp.
          </p>
          <p>
            Nada disso é gravado no site: não usamos banco de dados, não guardamos no seu navegador e não
            registramos em logs. Se você recarregar a página ou tocar em “Fazer outro pedido”, os dados somem.
          </p>

          <h2>O que fica no seu aparelho</h2>
          <p>
            Fica salva no seu navegador só a sacola (quais cookies e quantos), para você não perder a escolha.
            Você pode apagar a qualquer momento limpando os dados do site no navegador.
          </p>

          <h2>Serviços que o site consulta</h2>
          <ul>
            <li>
              <b>ViaCEP</b>: recebe o CEP digitado para preencher rua, bairro e cidade.
            </li>
            <li>
              <b>OpenStreetMap (Nominatim) e OSRM</b>: recebem o endereço, sem nome nem telefone, para
              calcular a distância de rota e a taxa de entrega.
            </li>
            <li>
              <b>Google Maps (Routes API)</b>: quando ativado pela loja, substitui o OpenStreetMap no cálculo
              da rota.
            </li>
            <li>
              <b>WhatsApp</b>: a mensagem do pedido é enviada por você, pelo seu WhatsApp, para a loja.
            </li>
          </ul>

          <h2>Cookies de rastreamento</h2>
          <p>
            O site não usa cookies de rastreamento nem de publicidade. Se um dia passarmos a usar ferramentas
            como Google Analytics ou Meta Pixel, vamos pedir o seu consentimento antes.
          </p>

          <h2>Seus direitos e contato</h2>
          <p>
            De acordo com a Lei Geral de Proteção de Dados (LGPD), você pode pedir informações sobre o uso dos
            seus dados. Como o site não guarda dados pessoais, as conversas do pedido ficam só no WhatsApp.
            Para qualquer dúvida, fale com a loja pelo WhatsApp{" "}
            <a href={`https://wa.me/${loja.contato.whatsapp}`} target="_blank" rel="noopener">
              {loja.contato.whatsappExibicao}
            </a>
            .
          </p>
        </div>
      </main>
      <Rodape />
    </>
  );
}
