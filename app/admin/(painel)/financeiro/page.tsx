import Link from "next/link";
import { adicionarDespesaAcao, excluirDespesaAcao } from "../../acoes";
import { Aviso } from "@/components/admin/Aviso";
import { brl } from "@/lib/formato";
import { isoData, paredeSP, somarDias } from "@/lib/tempo";
import { bancoConfigurado } from "@/server/db";
import {
  CATEGORIAS_DESPESA,
  listarDespesas,
  quebra,
  resumoFinanceiro,
  vendasPorSabor,
  type LinhaQuebra,
} from "@/server/financeiro";
import { exigirAdmin } from "@/server/sessao-admin";

type Busca = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Busca> };

const PERIODOS = [
  { id: "semana", rotulo: "Esta semana" },
  { id: "mes", rotulo: "Este mês" },
  { id: "mes-anterior", rotulo: "Mês passado" },
  { id: "30d", rotulo: "Últimos 30 dias" },
  { id: "ano", rotulo: "Este ano" },
  { id: "tudo", rotulo: "Tudo" },
] as const;

const ROTULOS: Record<string, string> = {
  entrega: "Entrega",
  retirada: "Retirada",
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
  site: "Site",
  pessoal: "Direto com a loja",
};

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const valido = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Período escolhido (datas de entrega, inclusive), no horário de São Paulo. */
function periodo(q: Busca) {
  const hoje = paredeSP(Date.now());
  const h = isoData(hoje);
  return { ...intervalo(q, hoje, h), hoje: h };
}

function intervalo(q: Busca, hoje: Date, h: string) {
  const inicioMes = h.slice(0, 8) + "01";
  if (valido(q.de) && valido(q.ate))
    return { id: "personalizado", de: q.de <= q.ate ? q.de : q.ate, ate: q.de <= q.ate ? q.ate : q.de };
  switch (q.p) {
    case "semana": {
      const desdeSegunda = (hoje.getUTCDay() + 6) % 7;
      return {
        id: "semana",
        de: isoData(somarDias(hoje, -desdeSegunda)),
        ate: isoData(somarDias(hoje, 6 - desdeSegunda)),
      };
    }
    case "mes-anterior": {
      const fimAnterior = somarDias(new Date(`${inicioMes}T12:00:00Z`), -1);
      return { id: "mes-anterior", de: isoData(fimAnterior).slice(0, 8) + "01", ate: isoData(fimAnterior) };
    }
    case "30d":
      return { id: "30d", de: isoData(somarDias(hoje, -29)), ate: h };
    case "ano":
      return { id: "ano", de: `${h.slice(0, 4)}-01-01`, ate: `${h.slice(0, 4)}-12-31` };
    case "tudo":
      return { id: "tudo", de: "2000-01-01", ate: "2100-12-31" };
    default: {
      const fim = somarDias(new Date(`${inicioMes}T12:00:00Z`), 40);
      const fimMes = isoData(somarDias(new Date(`${isoData(fim).slice(0, 8)}01T12:00:00Z`), -1));
      return { id: "mes", de: inicioMes, ate: fimMes };
    }
  }
}

export default async function Financeiro({ searchParams }: Props) {
  await exigirAdmin();
  const q = await searchParams;
  const per = periodo(q);
  const { hoje } = per;
  const volta =
    per.id === "personalizado"
      ? `/admin/financeiro?de=${per.de}&ate=${per.ate}`
      : `/admin/financeiro?p=${per.id}`;
  if (!bancoConfigurado()) return <h1>Financeiro</h1>;
  const [r, sabores, modalidade, pagamento, origem, despesas] = await Promise.all([
    resumoFinanceiro(per.de, per.ate),
    vendasPorSabor(per.de, per.ate),
    quebra("modalidade", per.de, per.ate),
    quebra("pagamento", per.de, per.ate),
    quebra("origem", per.de, per.ate),
    listarDespesas(per.de, per.ate),
  ]);
  const resultado = r.contribuicao - r.despesas;
  const porCategoria = Object.entries(
    despesas.reduce<Record<string, number>>(
      (m, d) => ({ ...m, [d.categoria]: (m[d.categoria] ?? 0) + d.valor }),
      {},
    ),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <Aviso busca={searchParams} />
      <h1>Financeiro</h1>

      <nav className="adm-acoes" aria-label="Período" style={{ marginTop: 0 }}>
        {PERIODOS.map((x) => (
          <Link
            key={x.id}
            href={`/admin/financeiro?p=${x.id}`}
            className={`adm-btn pequeno${per.id === x.id ? " primario" : ""}`}
            aria-current={per.id === x.id ? "page" : undefined}
          >
            {x.rotulo}
          </Link>
        ))}
      </nav>
      <form
        method="get"
        className="adm-acoes"
        style={{ alignItems: "center" }}
        aria-label="Período personalizado"
      >
        <input
          type="date"
          name="de"
          defaultValue={per.id === "tudo" ? "" : per.de}
          aria-label="De"
          style={{ width: 160 }}
        />
        <span className="adm-mute">até</span>
        <input
          type="date"
          name="ate"
          defaultValue={per.id === "tudo" ? "" : per.ate}
          aria-label="Até"
          style={{ width: 160 }}
        />
        <button className="adm-btn pequeno" type="submit">
          Ver
        </button>
      </form>
      <p className="adm-mute">
        {per.id === "tudo" ? "Todo o histórico" : `De ${dataBr(per.de)} a ${dataBr(per.ate)}`} · pela data de
        entrega · só pedidos concluídos
      </p>

      <div className="adm-resumo">
        <div>
          <span>Faturamento</span>
          <b>{brl(r.faturamento)}</b>
        </div>
        <div>
          <span>Resultado</span>
          <b style={{ color: resultado < 0 ? "var(--color-err)" : "var(--color-ok)" }}>{brl(resultado)}</b>
        </div>
        <div>
          <span>Pedidos concluídos</span>
          <b>{r.pedidos}</b>
        </div>
        <div>
          <span>Ticket médio</span>
          <b>{r.pedidos ? brl(r.faturamento / r.pedidos) : "—"}</b>
        </div>
        <div>
          <span>Cookies vendidos</span>
          <b>{r.cookies}</b>
        </div>
        <div>
          <span>Margem do resultado</span>
          <b>{r.faturamento ? pct(resultado / r.faturamento) : "—"}</b>
        </div>
      </div>

      <h2>Resultado do período</h2>
      <div className="adm-card">
        <div className="adm-valores" style={{ borderTop: 0, paddingTop: 0 }}>
          <Linha rotulo="Cookies" valor={r.receitaCookies} />
          <Linha rotulo="Frete cobrado" valor={r.frete} />
          <Linha rotulo="Faturamento" valor={r.faturamento} forte />
          <Linha rotulo="Custo dos cookies (receitas)" valor={-r.custoCookies} />
          <Linha rotulo="Embalagem (kraft e flyers)" valor={-r.embalagem} />
          <Linha rotulo="Taxas de pagamento" valor={-r.taxas} />
          <Linha rotulo="Combustível das entregas" valor={-r.combustivel} />
          <Linha rotulo="Contribuição dos pedidos" valor={r.contribuicao} forte />
          <Linha rotulo="Despesas do período" valor={-r.despesas} />
          <Linha rotulo="Resultado" valor={resultado} forte />
        </div>
        {r.semContribuicao > 0 && (
          <p className="adm-mute" style={{ marginBottom: 0 }}>
            {r.semContribuicao} pedido(s) concluído(s) sem contribuição calculada (frete a confirmar ou custo
            desconhecido): ficaram fora da contribuição.
          </p>
        )}
        <p className="adm-mute" style={{ marginBottom: 0 }}>
          Ainda pendentes: {r.pendentes} pedido(s), {brl(r.valorPendente)} · Cancelados ou abandonados:{" "}
          {r.perdidos}
        </p>
      </div>

      <h2>Por sabor</h2>
      <div className="adm-tabela">
        <table>
          <thead>
            <tr>
              <th>Sabor</th>
              <th className="num">Cookies</th>
              <th className="num">Receita</th>
              <th className="num">Custo</th>
              <th className="num">Lucro bruto</th>
            </tr>
          </thead>
          <tbody>
            {sabores.length === 0 && (
              <tr>
                <td colSpan={5} className="adm-mute">
                  Nenhuma venda no período.
                </td>
              </tr>
            )}
            {sabores.map((s) => (
              <tr key={s.sabor}>
                <td>{s.sabor}</td>
                <td className="num">{s.cookies}</td>
                <td className="num">{brl(s.receita)}</td>
                <td className="num">{s.custo == null ? "—" : brl(s.custo)}</td>
                <td className="num">{s.custo == null ? "—" : brl(s.receita - s.custo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Quebra titulo="Entrega × retirada" linhas={modalidade} />
      <Quebra titulo="Forma de pagamento" linhas={pagamento} />
      <Quebra titulo="Origem" linhas={origem} />

      <h2>Despesas</h2>
      <form action={adicionarDespesaAcao} className="adm-card">
        <input type="hidden" name="volta" value={volta} />
        <div className="adm-campos dois">
          <label className="adm-campo">
            <span>Data</span>
            <input type="date" name="data" defaultValue={hoje} required />
          </label>
          <label className="adm-campo">
            <span>Categoria</span>
            <select name="categoria" required defaultValue="">
              <option value="" disabled>
                Escolha…
              </option>
              {CATEGORIAS_DESPESA.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="adm-campo">
            <span>Descrição</span>
            <input name="descricao" maxLength={200} placeholder="Ex.: 2 kg de chocolate" />
          </label>
          <label className="adm-campo">
            <span>Valor (R$)</span>
            <input name="valor" inputMode="decimal" required placeholder="0,00" />
          </label>
        </div>
        <div className="adm-acoes">
          <button className="adm-btn primario" type="submit">
            Lançar despesa
          </button>
        </div>
      </form>

      {porCategoria.length > 0 && (
        <div className="adm-resumo" style={{ marginBottom: 12 }}>
          {porCategoria.map(([cat, v]) => (
            <div key={cat}>
              <span>{cat}</span>
              <b>{brl(v)}</b>
            </div>
          ))}
        </div>
      )}
      <div className="adm-tabela">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th className="num">Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {despesas.length === 0 && (
              <tr>
                <td colSpan={5} className="adm-mute">
                  Nenhuma despesa no período.
                </td>
              </tr>
            )}
            {despesas.map((d) => (
              <tr key={d.id}>
                <td>{dataBr(d.data)}</td>
                <td>{d.categoria}</td>
                <td>{d.descricao}</td>
                <td className="num">{brl(d.valor)}</td>
                <td>
                  <form action={excluirDespesaAcao}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="volta" value={volta} />
                    <button
                      className="adm-btn pequeno perigo"
                      type="submit"
                      aria-label={`Excluir despesa ${d.descricao}`}
                    >
                      ×
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: number; forte?: boolean }) {
  return (
    <div className={forte ? "total" : undefined}>
      <span>{rotulo}</span>
      <span className="tnum">{brl(valor)}</span>
    </div>
  );
}

function Quebra({ titulo, linhas }: { titulo: string; linhas: LinhaQuebra[] }) {
  if (!linhas.length) return null;
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  return (
    <>
      <h2>{titulo}</h2>
      <div className="adm-tabela">
        <table>
          <thead>
            <tr>
              <th></th>
              <th className="num">Pedidos</th>
              <th className="num">Faturamento</th>
              <th className="num">Participação</th>
              <th className="num">Contribuição</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.chave}>
                <td>{ROTULOS[l.chave] ?? l.chave}</td>
                <td className="num">{l.pedidos}</td>
                <td className="num">{brl(l.valor)}</td>
                <td className="num">{total ? pct(l.valor / total) : "—"}</td>
                <td className="num">{l.contribuicao == null ? "—" : brl(l.contribuicao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
