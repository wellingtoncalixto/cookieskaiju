import Link from "next/link";
import { criarPedidoManualAcao } from "../../../acoes";
import { Aviso } from "@/components/admin/Aviso";
import { loja } from "@/config/loja";
import { brl } from "@/lib/formato";
import { isoData, paredeSP } from "@/lib/tempo";
import { listarProdutos } from "@/server/cadastros";
import { exigirAdmin } from "@/server/sessao-admin";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Data de hoje em São Paulo (fora do componente: leitura do relógio). */
const hojeSP = () => isoData(paredeSP(Date.now()));

export default async function NovoPedido({ searchParams }: Props) {
  await exigirAdmin();
  const produtos = (await listarProdutos()).filter((p) => p.ativo);
  const hoje = hojeSP();

  return (
    <>
      <Aviso busca={searchParams} />
      <p style={{ marginTop: 16 }}>
        <Link href="/admin">← Operação</Link>
      </p>
      <h1>Novo pedido</h1>
      <p className="adm-mute">
        Para pedidos feitos fora do site (telefone, conversa, balcão). Usa os preços atuais, recebe o próximo
        número, reserva o estoque e entra no financeiro.
      </p>

      <form action={criarPedidoManualAcao}>
        <section className="adm-card">
          <h3 className="titulo-graf">Sabores</h3>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {produtos.map((p) => (
              <label key={p.id} className="adm-acoes" style={{ marginTop: 0, alignItems: "center" }}>
                <input type="hidden" name="produto" value={p.id} />
                <span style={{ flex: "1 1 160px" }}>
                  {p.nome} <span className="adm-mute">· {brl(p.preco)}</span>
                  {p.estoque != null && <span className="adm-mute"> · estoque {p.estoque}</span>}
                </span>
                <input
                  name={`qtd-${p.id}`}
                  type="number"
                  min={0}
                  max={200}
                  step={1}
                  placeholder="0"
                  aria-label={`Quantidade de ${p.nome}`}
                  style={{ width: 90 }}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="adm-card">
          <h3 className="titulo-graf">Entrega</h3>
          <div className="adm-campos dois" style={{ marginTop: 8 }}>
            <label className="adm-campo">
              <span>Entrega ou retirada</span>
              <select name="modalidade" defaultValue="entrega">
                <option value="entrega">Entrega</option>
                <option value="retirada">Retirada</option>
              </select>
            </label>
            <label className="adm-campo">
              <span>Data</span>
              <input type="date" name="data" defaultValue={hoje} required />
            </label>
            <label className="adm-campo">
              <span>Horário</span>
              <select name="faixa" defaultValue="agora">
                <option value="agora">
                  Para hoje ({loja.agenda.prazoMinimoMin} a {loja.agenda.prazoMaximoMin} min)
                </option>
                {loja.janelas.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.nome}
                  </option>
                ))}
                <option value="">Sem horário definido</option>
              </select>
            </label>
            <label className="adm-campo">
              <span>Cidade (entrega)</span>
              <select name="cidade" defaultValue={loja.areaAtendida[0]}>
                {loja.areaAtendida.map((c) => (
                  <option key={c}>{c}</option>
                ))}
                <option value="outra">Outra…</option>
              </select>
            </label>
            <label className="adm-campo">
              <span>Outra cidade (se escolheu “Outra”)</span>
              <input name="cidadeOutra" maxLength={80} />
            </label>
            <label className="adm-campo">
              <span>Frete cobrado (R$) — vazio = a confirmar</span>
              <input name="frete" inputMode="decimal" placeholder="0,00" />
            </label>
            <label className="adm-campo">
              <span>Distância de ida (km) — para o combustível</span>
              <input name="km" inputMode="decimal" placeholder="0" />
            </label>
          </div>
        </section>

        <section className="adm-card">
          <h3 className="titulo-graf">Pagamento e cliente</h3>
          <div className="adm-campos dois" style={{ marginTop: 8 }}>
            <label className="adm-campo">
              <span>Forma de pagamento</span>
              <select name="pagamento" defaultValue="pix">
                {loja.pagamentos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-campo">
              <span>Status</span>
              <select name="status" defaultValue="pendente">
                <option value="pendente">Pendente</option>
                <option value="concluido">Concluído (já entregue e pago)</option>
              </select>
            </label>
            <label className="adm-campo">
              <span>Origem</span>
              <select name="origem" defaultValue="pessoal">
                <option value="pessoal">Direto com a loja</option>
                <option value="site">Site</option>
              </select>
            </label>
            <label className="adm-campo">
              <span>Relação com o cliente</span>
              <select name="relacao" defaultValue="">
                <option value="">Não informado</option>
                <option value="novo">Novo cliente</option>
                <option value="conhecido">Conhecido</option>
              </select>
            </label>
            <label className="adm-campo">
              <span>Como conheceu a Cookies Kaiju</span>
              <input name="comoConheceu" maxLength={80} placeholder="Ex.: Instagram, indicação" />
            </label>
          </div>
        </section>

        <div className="adm-acoes">
          <button className="adm-btn primario" type="submit">
            Lançar pedido
          </button>
          <Link className="adm-btn" href="/admin">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
