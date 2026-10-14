import { SITE_URL, imagemProduto, loja, menorPreco, type Produto } from "@/config/loja";

const abs = (path: string) => `${SITE_URL}${path}`;
const preco = (v: number) => v.toFixed(2);
const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

const oferta = (p: Produto) => ({
  "@type": "Offer",
  price: preco(p.preco),
  priceCurrency: "BRL",
  availability: p.disponivel ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
  url: abs(`/cookies/${p.slug}`),
});

export function jsonLdPadaria() {
  const precos = loja.produtos.map((p) => p.preco);
  return {
    "@context": "https://schema.org",
    "@type": "Bakery",
    "@id": abs("/#loja"),
    name: loja.nome,
    url: abs("/"),
    logo: abs("/brand/logo-cookies-kaiju.png"),
    image: [abs("/og/og-padrao.jpg"), abs("/brand/mascote-logo.jpg")],
    description:
      "Cookies artesanais recheados de 120 g feitos em Mogi Mirim/SP, com entrega aos sábados e domingos em Mogi Mirim e Mogi Guaçu.",
    telephone: loja.contato.telefoneSchema,
    priceRange: `R$ ${Math.min(...precos)}–${Math.max(...precos)}`,
    servesCuisine: "Cookies",
    currenciesAccepted: "BRL",
    paymentAccepted: "Pix, cartão de crédito, cartão de débito, dinheiro",
    sameAs: [`https://www.instagram.com/${loja.contato.instagram}`],
    address: {
      "@type": "PostalAddress",
      addressLocality: loja.cidade,
      addressRegion: loja.uf,
      addressCountry: "BR",
    },
    areaServed: loja.areaAtendida.map((name) => ({ "@type": "City", name })),
    openingHoursSpecification: loja.janelas.map((j) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["https://schema.org/Saturday", "https://schema.org/Sunday"],
      opens: hhmm(j.inicio),
      closes: hhmm(j.fim),
    })),
    hasMenu: {
      "@type": "Menu",
      name: "Cardápio Cookies Kaiju",
      url: abs("/"),
      hasMenuSection: {
        "@type": "MenuSection",
        name: "Cookies",
        description: `Cookies recheados de ${loja.pesoGramas} g, a partir de R$ ${preco(menorPreco())}.`,
        hasMenuItem: loja.produtos.map((p) => ({
          "@type": "MenuItem",
          name: p.nome,
          description: p.descricao,
          image: abs(imagemProduto(p.slug)),
          url: abs(`/cookies/${p.slug}`),
          offers: oferta(p),
        })),
      },
    },
  };
}

export function jsonLdSite() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: loja.nome,
    url: abs("/"),
    inLanguage: "pt-BR",
    publisher: { "@id": abs("/#loja") },
  };
}

export function jsonLdProduto(p: Produto) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `Cookie ${p.nome}`,
      description: p.descricao,
      image: [abs(imagemProduto(p.slug))],
      sku: p.slug,
      brand: { "@type": "Brand", name: loja.nome },
      category: "Cookies recheados",
      weight: { "@type": "QuantitativeValue", value: loja.pesoGramas, unitCode: "GRM" },
      offers: { ...oferta(p), seller: { "@id": abs("/#loja") } },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: abs("/") },
        { "@type": "ListItem", position: 2, name: "Cookies", item: abs("/#cardapio") },
        { "@type": "ListItem", position: 3, name: p.nome, item: abs(`/cookies/${p.slug}`) },
      ],
    },
  ];
}

export function jsonLdFaq(perguntas: { pergunta: string; resposta: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: perguntas.map((q) => ({
      "@type": "Question",
      name: q.pergunta,
      acceptedAnswer: { "@type": "Answer", text: q.resposta },
    })),
  };
}

/** Serializa para <script type="application/ld+json"> sem permitir fechar a tag. */
export const serializarJsonLd = (dados: unknown) => JSON.stringify(dados).replace(/</g, "\\u003c");
