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
  /** Foto enviada pelo admin (URL). Sem ela, usa /cookies/{slug}.jpg. */
  foto?: string | null;
  /** Cartaz enviado pelo admin (URL). Sem ele, usa /cookies/posters/{slug}-cartaz.jpg. */
  cartaz?: string | null;
  /** Unidades em estoque (admin). Ausente/nulo = não controla. */
  estoque?: number | null;
};

export type Janela = {
  id: string;
  /** Minutos desde 0h (horário de São Paulo). */
  inicio: number;
  fim: number;
  nome: string;
};

export type FormaPagamento = {
  id: "pix" | "credito" | "debito" | "dinheiro";
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

  /** Cardápio de reserva: vale enquanto o banco não estiver configurado (o admin é a fonte quando está). */
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

  /**
   * Horário de funcionamento padrão, por dia da semana (0 = domingo … 6 = sábado), em minutos desde 0h.
   * O admin muda em Admin → Horário (tabela horario_funcionamento); este vale sem banco ou se a leitura falhar.
   * As faixas de 1 hora para agendar são geradas dentro do horário de cada dia (src/lib/horario.ts).
   */
  horarioPadrao: [
    { aberto: true, abre: 13 * 60, fecha: 18 * 60 },
    { aberto: false, abre: 13 * 60, fecha: 18 * 60 },
    { aberto: false, abre: 13 * 60, fecha: 18 * 60 },
    { aberto: false, abre: 13 * 60, fecha: 18 * 60 },
    { aberto: false, abre: 13 * 60, fecha: 18 * 60 },
    { aberto: false, abre: 13 * 60, fecha: 18 * 60 },
    { aberto: true, abre: 13 * 60, fecha: 18 * 60 },
  ] satisfies { aberto: boolean; abre: number; fecha: number }[] as {
    aberto: boolean;
    abre: number;
    fecha: number;
  }[],

  /** O cliente sempre pode fazer o pedido; dias e horas vêm do horário de funcionamento. */
  agenda: {
    /**
     * Pedido para hoje (aceito até o fechamento do dia): o cliente não escolhe horário; recebe (ou retira)
     * entre `prazoMinimoMin` e `prazoMaximoMin` depois do pedido (ou da abertura, se pedir antes de abrir).
     */
    prazoMinimoMin: 60,
    prazoMaximoMin: 90,
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
      id: "credito",
      nome: "Cartão de crédito",
      descricao: "Só por aproximação",
      naMensagem: "Cartão de crédito por aproximação (na entrega)",
    },
    {
      id: "debito",
      nome: "Cartão de débito",
      descricao: "Só por aproximação",
      naMensagem: "Cartão de débito por aproximação (na entrega)",
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
