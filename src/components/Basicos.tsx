import { IconeCadeado } from "@/components/Icones";
import { REGISTRO_PEDIDOS_ATIVO } from "@/config/registro";
import { serializarJsonLd } from "@/lib/seo";

/** Dados estruturados renderizados no servidor. */
export function JsonLd({ dados }: { dados: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializarJsonLd(dados) }} />;
}

/** Avisos de privacidade (LGPD) das etapas 1 e 2. */
export function AvisoPrivacidade({ variante }: { variante: "endereco" | "dados" }) {
  if (variante === "endereco") {
    return (
      <div className="privacy small" role="note">
        <IconeCadeado />
        <div>
          <p>
            O CEP e o endereço são usados só para encontrar a rua e calcular a taxa de entrega, em serviços
            públicos de mapa. Nada fica salvo no site.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="privacy" role="note">
      <IconeCadeado />
      <div>
        <b>Seus dados não ficam salvos.</b>
        <p>
          Nome e endereço servem só para montar a mensagem do pedido que você envia para a Cookies Kaiju pelo
          WhatsApp. O site não guarda nenhum desses dados.
          {REGISTRO_PEDIDOS_ATIVO &&
            " Para controle da loja, fica registrado só um resumo do pedido (sabores, valores, cidade e forma de pagamento), sem dados pessoais."}
        </p>
      </div>
    </div>
  );
}
