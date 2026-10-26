import Link from "next/link";
import { notFound } from "next/navigation";
import { salvarProdutoAcao } from "../../../acoes";
import { Aviso } from "@/components/admin/Aviso";
import { CampoImagem } from "@/components/admin/CampoImagem";
import { brl } from "@/lib/formato";
import { listarProdutos, obterProduto, type ProdutoAdmin } from "@/server/cadastros";
import { obterBanco } from "@/server/db";
import { exigirAdmin } from "@/server/sessao-admin";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditarProduto({ params, searchParams }: Props) {
  await exigirAdmin();
  const { id } = await params;
  const novo = id === "novo";
  let p: ProdutoAdmin | undefined;
  if (!novo) {
    const n = Number(id);
    if (!Number.isInteger(n)) notFound();
    p = await obterProduto(n);
    if (!p) notFound();
  }
  const [receitas, todos] = await Promise.all([
    obterBanco().consulta<{ id: number; nome: string }>(
      "select id, nome from receitas where tipo = 'sabor' order by nome",
    ),
    listarProdutos(),
  ]);
  const proximaOrdem = Math.max(0, ...todos.map((t) => t.ordem)) + 1;

  return (
    <>
      <Aviso busca={searchParams} />
      <p style={{ marginTop: 16 }}>
        <Link href="/admin/produtos">← Produtos</Link>
      </p>
      <h1>{novo ? "Novo produto" : p!.nome}</h1>
      {p && p.custo != null && (
        <p className="adm-mute">
          Custo {brl(p.custo)} · lucro {brl(p.preco - p.custo)} por cookie
        </p>
      )}
      <form action={salvarProdutoAcao} className="adm-card">
        {p && <input type="hidden" name="id" value={p.id} />}
        <div className="adm-campos dois">
          <label className="adm-campo">
            <span>Nome</span>
            <input name="nome" defaultValue={p?.nome} required maxLength={60} />
          </label>
          <label className="adm-campo">
            <span>Endereço no site (cookieskaiju.com.br/cookies/…)</span>
            <input
              name="slug"
              defaultValue={p?.slug}
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              title="Só letras minúsculas, números e hífen. Ex.: doce-de-leite"
            />
          </label>
          <label className="adm-campo">
            <span>Preço de venda (R$)</span>
            <input
              name="preco"
              inputMode="decimal"
              defaultValue={p ? String(p.preco).replace(".", ",") : ""}
              required
            />
          </label>
          <label className="adm-campo">
            <span>Destaque (o recheio, em laranja)</span>
            <input name="destaque" defaultValue={p?.destaque} maxLength={80} />
          </label>
          <label className="adm-campo" style={{ gridColumn: "1 / -1" }}>
            <span>Descrição</span>
            <textarea name="descricao" defaultValue={p?.descricao} maxLength={400} />
          </label>
          <label className="adm-campo" style={{ gridColumn: "1 / -1" }}>
            <span>Descrição da foto (acessibilidade)</span>
            <input name="alt" defaultValue={p?.alt} maxLength={200} />
          </label>
          <label className="adm-campo">
            <span>Receita (para o custo)</span>
            <select name="receitaId" defaultValue={p?.receitaId ?? ""}>
              <option value="">Sem receita</option>
              {receitas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="adm-campo">
            <span>Ordem no cardápio</span>
            <input name="ordem" type="number" defaultValue={p?.ordem ?? proximaOrdem} />
          </label>
          <CampoImagem
            nome="foto"
            rotulo={novo ? "Foto (obrigatória)" : "Trocar foto"}
            atual={p?.foto ?? null}
          />
          <CampoImagem nome="cartaz" rotulo="Cartaz (opcional)" atual={p?.cartaz ?? null} />
          <label className="adm-check">
            <input type="checkbox" name="disponivel" defaultChecked={p?.disponivel ?? true} />
            Disponível (desmarcado = esgotado)
          </label>
          <label className="adm-check">
            <input type="checkbox" name="ativo" defaultChecked={p?.ativo ?? true} />
            Ativo (desmarcado = some do site)
          </label>
        </div>
        <div className="adm-acoes">
          <button className="adm-btn primario" type="submit">
            Salvar
          </button>
          {p && (
            <Link className="adm-btn" href={`/cookies/${p.slug}`} target="_blank">
              Ver no site
            </Link>
          )}
        </div>
      </form>
    </>
  );
}
