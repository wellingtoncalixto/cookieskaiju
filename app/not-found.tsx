import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CabecalhoSite, Rodape } from "@/components/Moldura";
import mascote from "../public/brand/mascote-com-fome.png";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: true },
};

export default function NaoEncontrada() {
  return (
    <>
      <CabecalhoSite />
      <main id="conteudo" className="col screen enviado">
        <div className="done">
          <Image src={mascote} alt="Mascote da Cookies Kaiju com fome" width={150} />
          <h1>Página não encontrada</h1>
          <p>O kaiju procurou por toda parte e não achou esta página. Que tal voltar para os cookies?</p>
          <Link className="btn btn-primary" href="/">
            Ver o cardápio
          </Link>
        </div>
      </main>
      <Rodape />
    </>
  );
}
