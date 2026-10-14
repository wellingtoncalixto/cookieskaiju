import Image from "next/image";
import { loja } from "@/config/loja";
import logo from "../../public/brand/logo-cookies-kaiju.png";
import mascote from "../../public/brand/mascote-abracando-cookie.png";

export function Capa() {
  return (
    <header className="cover">
      <div className="wrap">
        <div className="type">
          <Image className="logo" src={logo} alt="Cookies Kaiju" sizes="(max-width: 560px) 150px, 230px" />
          <p className="tag">{loja.slogan}</p>
        </div>
        {/* Imagem LCP da home (a maior acima da dobra): a única com preload. */}
        <Image
          className="mascot"
          src={mascote}
          alt=""
          preload
          fetchPriority="high"
          sizes="(max-width: 560px) 125px, 175px"
        />
      </div>
    </header>
  );
}
