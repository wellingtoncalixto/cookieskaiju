import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, League_Spartan, Manrope, Permanent_Marker } from "next/font/google";
import { JsonLd } from "@/components/Basicos";
import { Catalogo } from "@/components/Catalogo";
import { HidratarSacola } from "@/components/HidratarSacola";
import { WhatsAppFlutuante } from "@/components/WhatsAppFlutuante";
import { SITE_URL, loja } from "@/config/loja";
import { jsonLdPadaria } from "@/lib/seo";
import { obterCatalogo } from "@/server/catalogo";
import "./globals.css";

const leagueSpartan = League_Spartan({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
  variable: "--font-league-spartan",
});
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
});
// Fontes secundárias sem preload: não disputam banda com a imagem LCP.
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  preload: false,
  variable: "--font-barlow-condensed",
});
const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-permanent-marker",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Cookies Kaiju | Cookies artesanais em Mogi Mirim",
    template: "%s | Cookies Kaiju",
  },
  description:
    "Cookies artesanais recheados de 120 g feitos em Mogi Mirim/SP. Peça pelo site e receba aos sábados e domingos em Mogi Mirim e Mogi Guaçu.",
  applicationName: loja.nome,
  keywords: [
    "cookies Mogi Mirim",
    "cookie recheado",
    "cookies artesanais",
    "delivery de cookies",
    "cookies Mogi Guaçu",
  ],
  authors: [{ name: loja.nome, url: SITE_URL }],
  creator: loja.nome,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: loja.nome,
    images: [{ url: "/og/og-padrao.jpg", width: 1200, height: 630, alt: "Cookies Kaiju" }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  colorScheme: "dark",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  const produtos = await obterCatalogo();
  return (
    <html
      lang="pt-BR"
      className={`${leagueSpartan.variable} ${manrope.variable} ${barlowCondensed.variable} ${permanentMarker.variable}`}
    >
      <body>
        <a className="skip" href="#conteudo">
          Pular para o conteúdo
        </a>
        <Catalogo produtos={produtos}>
          <JsonLd dados={jsonLdPadaria(produtos)} />
          <HidratarSacola />
          {children}
          <WhatsAppFlutuante />
          {modal}
        </Catalogo>
      </body>
    </html>
  );
}
