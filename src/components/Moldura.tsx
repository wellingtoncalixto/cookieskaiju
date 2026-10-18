import Image from "next/image";
import Link from "next/link";
import { loja } from "@/config/loja";
import logo from "../../public/brand/logo-cookies-kaiju.png";

const links = [
  { href: "/#cardapio", nome: "Cardápio" },
  { href: "/como-funciona", nome: "Como funciona", opcional: true },
  { href: "/entrega", nome: "Entrega" },
];

/** Cabeçalho das páginas de conteúdo (a home usa a capa). */
export function CabecalhoSite({ atual }: { atual?: string }) {
  return (
    <header className="site-head">
      <div className="wrap">
        <Link href="/" aria-label="Cookies Kaiju, voltar ao cardápio">
          <Image src={logo} alt="Cookies Kaiju" height={48} sizes="54px" />
        </Link>
        <nav aria-label="Principal">
          <ul>
            {links.map((l) => (
              <li key={l.href} className={l.opcional ? "opt" : undefined}>
                <Link href={l.href} aria-current={atual === l.href ? "page" : undefined}>
                  {l.nome}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

/** Rodapé com links para todas as páginas indexáveis e o contato. */
export function Rodape() {
  return (
    <footer className="site-foot">
      <div className="wrap">
        <div>
          <h2>{loja.nome}</h2>
          <p>
            Cookies artesanais recheados de {loja.pesoGramas} g, feitos em {loja.cidade}/{loja.uf}. Entregas
            aos sábados e domingos em Mogi Mirim e Mogi Guaçu.
          </p>
        </div>
        <nav aria-label="Rodapé">
          <h2>Site</h2>
          <ul>
            <li>
              <Link href="/">Cardápio</Link>
            </li>
            <li>
              <Link href="/como-funciona">Como funciona</Link>
            </li>
            <li>
              <Link href="/entrega">Entrega em Mogi Mirim e Mogi Guaçu</Link>
            </li>
            <li>
              <Link href="/privacidade">Privacidade</Link>
            </li>
          </ul>
        </nav>
        <div>
          <h2>Contato</h2>
          <ul>
            <li>
              <a href={`https://wa.me/${loja.contato.whatsapp}`} target="_blank" rel="noopener">
                WhatsApp {loja.contato.whatsappExibicao}
              </a>
            </li>
            <li>
              <a href={`https://www.instagram.com/${loja.contato.instagram}`} target="_blank" rel="noopener">
                Instagram @{loja.contato.instagram}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
