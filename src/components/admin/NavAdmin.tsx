"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", rotulo: "Operação" },
  { href: "/admin/produtos", rotulo: "Produtos" },
  { href: "/admin/precificacao", rotulo: "Precificação" },
  { href: "/admin/compras", rotulo: "Compras" },
  { href: "/admin/financeiro", rotulo: "Financeiro" },
];

export function NavAdmin({ sair }: { sair: () => Promise<void> }) {
  const caminho = usePathname();
  const atual = (href: string) => (href === "/admin" ? caminho === href : caminho.startsWith(href));
  return (
    <nav className="adm-nav" aria-label="Seções do admin">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={atual(l.href) ? "page" : undefined}>
          {l.rotulo}
        </Link>
      ))}
      <form action={sair}>
        <button type="submit">Sair</button>
      </form>
    </nav>
  );
}
