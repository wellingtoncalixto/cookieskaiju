/**
 * CONFIGURAÇÃO DA LOJA — fonte única de verdade.
 *
 * Preços, sabores, disponibilidade, agenda, janelas de entrega, frete, promoção,
 * formas de pagamento e contato ficam aqui. Cardápio, ficha do produto, sacola,
 * mensagem do WhatsApp, JSON-LD e textos "a partir de R$" leem deste arquivo.
 */

export type Produto = {
  slug: string;
  nome: string;
  /** Subtítulo laranja (o recheio). */
  destaque: string;
  descricao: string;
  /** Preço em reais. */
  preco: number;
  /** `false` mostra "Esgotado" e impede a adição à sacola. */
  disponivel: boolean;
  /** Texto alternativo descritivo da foto. */
  alt: string;
};

export type Janela = {
  id: string;
  /** Minutos desde 0h (horário de São Paulo). */
  inicio: number;
  fim: number;
  nome: string;
};

export type FormaPagamento = {
  id: "pix" | "cartao" | "dinheiro";
  nome: string;
  descricao: string;
  /** Como a forma aparece na mensagem do WhatsApp. */
  naMensagem: string;
};

export const loja = {
  nome: "Cookies Kaiju",
  slogan: "Cookies monstruosamente grandes.",
  descricaoCurta: "Cookies artesanais · Mogi Mirim/SP",
  cidade: "Mogi Mirim",
  uf: "SP",
  fuso: "America/Sao_Paulo",

  contato: {
    /** Só números, com 55 + DDD. Pode ser sobrescrito por NEXT_PUBLIC_WHATSAPP. */
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "5519984268415",
    whatsappExibicao: "+55 (19) 98426-8415",
    telefoneSchema: "+55-19-98426-8415",
    instagram: "cookieskaiju",
  },

  /** A sacola é apagada se o cliente ficar este tempo sem voltar ao site (cada visita renova o prazo). */
  sacolaExpiraHoras: 24,

  /** Peso de todos os cookies, em gramas. */
  pesoGramas: 120,

  produtos: [
    {
      slug: "explosao-de-nutella",
      nome: "Explosão de Nutella",
      destaque: "Recheio de Nutella",
      descricao: "Massa de baunilha com gotas de chocolate nobre e recheio de Nutella.",
      preco: 18.0,
      disponivel: true,
      alt: "Cookie Explosão de Nutella cortado ao meio com recheio de Nutella escorrendo",
    },
    {
      slug: "ninho-black",
      nome: "Ninho Black",
      destaque: "Recheio de brigadeiro de Ninho",
      descricao: "Massa de cacau black com gotas de chocolate branco nobre e recheio de brigadeiro de Ninho.",
      preco: 19.0,
      disponivel: true,
      alt: "Cookie Ninho Black de massa escura cortado ao meio com recheio cremoso de brigadeiro de Ninho",
    },
    {
      slug: "duplo-maltine",
      nome: "Duplo Maltine",
      destaque: "Recheio de creme de Ovomaltine",
      descricao:
        "Massa de baunilha com gotas de chocolate nobre, flocos de Ovomaltine e recheio de creme de Ovomaltine.",
      preco: 23.0,
      disponivel: true,
      alt: "Cookie Duplo Maltine cortado ao meio com recheio de creme de Ovomaltine e flocos crocantes",
    },
    {
      slug: "kinder",
      nome: "Kinder",
      destaque: "Recheio de Kinder Bueno",
      descricao: "Massa de baunilha com gotas de chocolate nobre preto e branco e recheio de Kinder Bueno.",
      preco: 25.0,
      disponivel: true,
      alt: "Cookie Kinder cortado ao meio com pedaços de Kinder Bueno e recheio cremoso",
    },
  ] satisfies Produto[] as Produto[],

  /** Faixas de horário para agendar a entrega ou a retirada (de 1 em 1 hora, dentro do funcionamento). */
  janelas: [
    { id: "13h", inicio: 13 * 60, fim: 14 * 60, nome: "13h às 14h" },
    { id: "14h", inicio: 14 * 60, fim: 15 * 60, nome: "14h às 15h" },
    { id: "15h", inicio: 15 * 60, fim: 16 * 60, nome: "15h às 16h" },
    { id: "16h", inicio: 16 * 60, fim: 17 * 60, nome: "16h às 17h" },
    { id: "17h", inicio: 17 * 60, fim: 18 * 60, nome: "17h às 18h" },
  ] satisfies Janela[] as Janela[],

  /** Funcionamento: sábado e domingo, das 13h às 18h, com delivery. O pedido nunca é bloqueado. */
  agenda: {
    /** Dias abertos (0 = domingo … 6 = sábado). */
    diasAbertos: [6, 0],
    abreMin: 13 * 60,
    fechaMin: 18 * 60,
    /**
     * Pedido para hoje: o cliente não escolhe horário; recebe (ou retira) entre `prazoMinimoMin` e
     * `prazoMaximoMin` depois do pedido (ou da abertura, se pedir antes de abrir).
     */
    prazoMinimoMin: 60,
    prazoMaximoMin: 90,
    /** Último horário para pedir para hoje (17h + 60 min de prazo mínimo = fechamento às 18h). */
    pedidoHojeAteMin: 17 * 60,
    /** Quantos dias de funcionamento (depois de hoje) aparecem para agendar. 4 = os dois próximos fins de semana. */
    diasParaAgendar: 4,
  },

  frete: {
    base: 3.0,
    kmInclusos: 3,
    porKm: 1.0,
    /** CEP de origem (não é exibido no site; serve para o link de rota da mensagem). */
    origemCep: "13808-113",
    origemCidade: "Mogi Mirim",
    /** Coordenadas encontradas a mais de X km (linha reta) da loja são descartadas como erro de busca. */
    raioMaxKm: 30,
    /** Rotas acima de X km viram "a confirmar" em vez de uma taxa improvável. */
    rotaMaxKm: 60,
  },

  retirada: {
    /** `false` esconde a opção de retirada no checkout. */
    habilitada: true,
    /** O endereço da loja não aparece no site: o local é combinado pelo WhatsApp. */
    aviso: "O local de retirada é combinado com a loja pelo WhatsApp, na confirmação do pedido.",
  },

  promo: {
    /** Última data de ENTREGA com promoção (inclusive), no formato AAAA-MM-DD. */
    ate: "2026-10-31",
    cidades: [
      { nome: "Mogi Mirim", min: 3 },
      { nome: "Mogi Guaçu", min: 4 },
    ],
  },

  pagamentos: [
    { id: "pix", nome: "Pix", descricao: "Chave enviada na confirmação", naMensagem: "Pix" },
    {
      id: "cartao",
      nome: "Cartão",
      descricao: "Crédito ou débito, só por aproximação",
      naMensagem: "Cartão por aproximação (na entrega)",
    },
    { id: "dinheiro", nome: "Dinheiro", descricao: "Na entrega", naMensagem: "Dinheiro" },
  ] satisfies FormaPagamento[] as FormaPagamento[],

  areaAtendida: ["Mogi Mirim", "Mogi Guaçu"],
} as const;

/** Liga o modo teste (libera o próximo fim de semana a qualquer hora). */
export const MODO_TESTE = process.env.NEXT_PUBLIC_MODO_TESTE === "true";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.cookieskaiju.com.br").replace(
  /\/$/,
  "",
);

export const produtoPorSlug = (slug: string) => loja.produtos.find((p) => p.slug === slug);

export const menorPreco = () => Math.min(...loja.produtos.map((p) => p.preco));

export const imagemProduto = (slug: string) => `/cookies/${slug}.jpg`;
export const posterProduto = (slug: string) => `/cookies/posters/${slug}-cartaz.jpg`;
