import Link from "next/link";
import { Aviso } from "@/components/admin/Aviso";
import { imagemProduto } from "@/lib/catalogo";
import { brl } from "@/lib/formato";
import { listarProdutos } from "@/server/cadastros";
import { bancoConfigurado } from "@/server/db";
import { exigirAdmin } from "@/server/sessao-admin";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

export default async function Produtos({ searchParams }: Props) {
  await exigirAdmin();
  const produtos = bancoConfigurado() ? await listarProdutos() : [];
  return (
    <>
      <Aviso busca={searchParams} />
      <h1>Produtos</h1>
      <p className="adm-mute">
        O cardápio do site vem daqui. Inativo some do site; indisponível aparece como esgotado.
      </p>
      <div className="adm-acoes" style={{ marginBottom: 12 }}>
        <Link className="adm-btn primario" href="/admin/produtos/novo">
          Novo produto
        </Link>
      </div>
      <div className="adm-tabela">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Produto</th>
              <th className="num">Preço</th>
              <th className="num">Custo</th>
              <th className="num">Lucro</th>
              <th className="num">Margem</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((p) => (
              <tr key={p.id}>
                <td>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="adm-foto" src={imagemProduto(p)} alt="" />
                </td>
                <td>
                  <Link href={`/admin/produtos/${p.id}`}>{p.nome}</Link>
                </td>
                <td className="num">{brl(p.preco)}</td>
                <td className="num">{p.custo == null ? "—" : brl(p.custo)}</td>
                <td className="num">{p.custo == null ? "—" : brl(p.preco - p.custo)}</td>
                <td className="num">
                  {p.custo == null || !p.preco ? "—" : pct((p.preco - p.custo) / p.preco)}
                </td>
                <td>{!p.ativo ? "Inativo" : p.disponivel ? "À venda" : "Esgotado"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {produtos.some((p) => p.custo == null) && (
        <p className="adm-mute">Custo “—”: produto sem receita ligada (veja Precificação).</p>
      )}
    </>
  );
}
