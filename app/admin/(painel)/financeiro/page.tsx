import Link from "next/link";
import { adicionarDespesaAcao, excluirDespesaAcao } from "../../acoes";
import { Aviso } from "@/components/admin/Aviso";
import {
  BarraComposicao,
  BarrasHorizontais,
  Colunas,
  type Coluna,
  type Cor,
  type ItemBarra,
  type Parte,
} from "@/components/admin/Graficos";
import { brl } from "@/lib/formato";
import { isoData, paredeSP, somarDias } from "@/lib/tempo";
import { bancoConfigurado } from "@/server/db";
import {
  CATEGORIAS_DESPESA,
  listarDespesas,
  quebra,
  resumoFinanceiro,
  vendasPorSabor,
  vendasPorSemana,
  type LinhaQuebra,
  type PontoSemana,
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
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const curto = (v: number) =>
  Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace(".", ",")} mil` : brl(v);
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

/** Semanas entre a primeira e a última venda, incluindo as sem venda (zero), para o tempo não "pular". */
function semanasCompletas(pontos: PontoSemana[]) {
  if (!pontos.length) return [];
  const mapa = new Map(pontos.map((p) => [p.inicio, p]));
  const fim = Date.parse(`${pontos.at(-1)!.inicio}T12:00:00Z`);
  const lista: PontoSemana[] = [];
  for (let t = Date.parse(`${pontos[0].inicio}T12:00:00Z`); t <= fim; t += 7 * 86_400_000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    lista.push(mapa.get(iso) ?? { inicio: iso, pedidos: 0, faturamento: 0, cookies: 0 });
  }
  return lista.slice(-26);
}

/** Fatias de uma quebra (modalidade, pagamento, origem), sempre na mesma ordem e cor. */
function partes(linhas: LinhaQuebra[], ordem: string[]): Parte[] {
  const cores: Cor[] = ["azul", "laranja", "verde", "amarelo"];
  const chaves = [
    ...ordem.filter((o) => linhas.some((l) => l.chave === o)),
    ...linhas.map((l) => l.chave).filter((c) => !ordem.includes(c)),
  ];
  return chaves.map((chave) => {
    const l = linhas.find((x) => x.chave === chave)!;
    const posicao = ordem.includes(chave) ? ordem.indexOf(chave) : ordem.length;
    return {
      rotulo: ROTULOS[chave] ?? chave,
      valor: l.valor,
      texto: `${brl(l.valor)} · ${l.pedidos} ped.`,
      cor: cores[Math.min(posicao, cores.length - 1)],
    };
  });
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
  const [r, sabores, modalidade, pagamento, origem, despesas, semanas] = await Promise.all([
    resumoFinanceiro(per.de, per.ate),
    vendasPorSabor(per.de, per.ate),
    quebra("modalidade", per.de, per.ate),
    quebra("pagamento", per.de, per.ate),
    quebra("origem", per.de, per.ate),
    listarDespesas(per.de, per.ate),
    vendasPorSemana(per.de, per.ate),
  ]);
  const resultado = r.contribuicao - r.despesas;
  const porCategoria = Object.entries(
    despesas.reduce<Record<string, number>>(
      (m, d) => ({ ...m, [d.categoria]: (m[d.categoria] ?? 0) + d.valor }),
      {},
    ),
  ).sort((a, b) => b[1] - a[1]);

  // "Para onde foi o dinheiro": do faturamento até o resultado.
  const cascata: ItemBarra[] = [
    { rotulo: "Faturamento", valor: r.faturamento, texto: brl(r.faturamento), cor: "azul" },
    { rotulo: "Custo dos cookies", valor: r.custoCookies, texto: `− ${brl(r.custoCookies)}`, cor: "cinza" },
    { rotulo: "Embalagem", valor: r.embalagem, texto: `− ${brl(r.embalagem)}`, cor: "cinza" },
    { rotulo: "Taxas de pagamento", valor: r.taxas, texto: `− ${brl(r.taxas)}`, cor: "cinza" },
    { rotulo: "Combustível", valor: r.combustivel, texto: `− ${brl(r.combustivel)}`, cor: "cinza" },
    { rotulo: "Despesas", valor: r.despesas, texto: `− ${brl(r.despesas)}`, cor: "cinza" },
    {
      rotulo: resultado < 0 ? "Prejuízo" : "Resultado",
      valor: resultado,
      texto: brl(resultado),
      cor: resultado < 0 ? "vermelho" : "azul",
    },
  ];
  const pontos: Coluna[] = semanasCompletas(semanas).map((s) => {
    const sabado = isoData(somarDias(new Date(`${s.inicio}T12:00:00Z`), 5));
    return {
      rotulo: ddmm(sabado),
      valor: s.faturamento,
      texto: brl(s.faturamento),
      detalhe: `Fim de semana de ${ddmm(sabado)} · ${s.pedidos} pedido(s), ${s.cookies} cookies`,
    };
  });

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
        {per.id === "tudo" ? "Todo o histórico" : `De ${dataBr(per.de)} a ${dataBr(per.ate)}`} · vendas =
        pedidos concluídos, pela data de entrega
      </p>

      <div className="adm-kpis">
        <div className="adm-kpi">
          <span>Faturamento</span>
          <b>{brl(r.faturamento)}</b>
          <small>
            cookies {curto(r.receitaCookies)} + frete {curto(r.frete)}
          </small>
        </div>
        <div className="adm-kpi">
          <span>{resultado < 0 ? "Prejuízo" : "Resultado"}</span>
          <b style={{ color: resultado < 0 ? "var(--color-err)" : undefined }}>{brl(resultado)}</b>
          <small>{r.faturamento ? `${pct(resultado / r.faturamento)} do faturamento` : "—"}</small>
        </div>
        <div className="adm-kpi">
          <span>Pedidos concluídos</span>
          <b>{r.pedidos}</b>
          <small>{r.cookies} cookies vendidos</small>
        </div>
        <div className="adm-kpi">
          <span>Ticket médio</span>
          <b>{r.pedidos ? brl(r.faturamento / r.pedidos) : "—"}</b>
          <small>por pedido</small>
        </div>
      </div>
      {(r.pendentes > 0 || r.perdidos > 0 || r.semContribuicao > 0) && (
        <p className="adm-mute">
          {r.pendentes > 0 &&
            `Ainda pendentes: ${r.pendentes} pedido(s), ${brl(r.valorPendente)} (fora das contas até serem marcados como concluídos na Operação). `}
          {r.perdidos > 0 && `Cancelados ou abandonados: ${r.perdidos}. `}
          {r.semContribuicao > 0 &&
            `${r.semContribuicao} pedido(s) com frete a confirmar ficaram fora dos custos.`}
        </p>
      )}

      <section className="adm-card" aria-labelledby="g-dinheiro">
        <h3 className="titulo-graf" id="g-dinheiro">
          Para onde foi o dinheiro
        </h3>
        <p className="sub-graf">Do faturamento ao {resultado < 0 ? "prejuízo" : "resultado"} do período</p>
        <BarrasHorizontais
          rotulo="Do faturamento ao resultado"
          itens={cascata}
          maximo={Math.max(r.faturamento, Math.abs(resultado))}
        />
      </section>

      <div className="adm-graficos" style={{ marginTop: 12 }}>
        <section className="adm-card" aria-labelledby="g-semanas">
          <h3 className="titulo-graf" id="g-semanas">
            Faturamento por fim de semana
          </h3>
          <p className="sub-graf">Data do sábado · toque numa coluna para ver os pedidos</p>
          <Colunas rotulo="Faturamento por fim de semana" pontos={pontos} />
        </section>

        <section className="adm-card" aria-labelledby="g-sabores">
          <h3 className="titulo-graf" id="g-sabores">
            Cookies vendidos por sabor
          </h3>
          <p className="sub-graf">Quantidade · toque para ver receita e lucro bruto</p>
          <BarrasHorizontais
            rotulo="Cookies vendidos por sabor"
            itens={sabores.map((s) => ({
              rotulo: s.sabor,
              valor: s.cookies,
              texto: `${s.cookies} un.`,
              detalhe: `${brl(s.receita)} de receita${s.custo == null ? "" : ` · lucro bruto ${brl(s.receita - s.custo)}`}`,
            }))}
          />
        </section>
      </div>

      <div className="adm-graficos tres" style={{ marginTop: 12 }}>
        <section className="adm-card" aria-labelledby="g-modalidade">
          <h3 className="titulo-graf" id="g-modalidade">
            Entrega × retirada
          </h3>
          <p className="sub-graf">Faturamento</p>
          <BarraComposicao rotulo="Entrega e retirada" partes={partes(modalidade, ["entrega", "retirada"])} />
        </section>
        <section className="adm-card" aria-labelledby="g-pagamento">
          <h3 className="titulo-graf" id="g-pagamento">
            Forma de pagamento
          </h3>
          <p className="sub-graf">Faturamento</p>
          <BarraComposicao
            rotulo="Formas de pagamento"
            partes={partes(pagamento, ["pix", "credito", "debito", "dinheiro"])}
          />
        </section>
        <section className="adm-card" aria-labelledby="g-origem">
          <h3 className="titulo-graf" id="g-origem">
            Origem
          </h3>
          <p className="sub-graf">Faturamento</p>
          <BarraComposicao rotulo="Origem dos pedidos" partes={partes(origem, ["site", "pessoal"])} />
        </section>
      </div>

      <h2>Despesas</h2>
      <section className="adm-card" aria-labelledby="g-despesas">
        <h3 className="titulo-graf" id="g-despesas">
          Despesas por categoria · {brl(r.despesas)}
        </h3>
        <p className="sub-graf">Compras e gastos lançados no período</p>
        <BarrasHorizontais
          rotulo="Despesas por categoria"
          itens={porCategoria.map(([cat, v]) => ({
            rotulo: cat,
            valor: v,
            texto: brl(v),
            cor: "laranja" as const,
          }))}
        />
      </section>

      <details className="adm-card adm-receita">
        <summary>
          <h3>+ Lançar despesa</h3>
        </summary>
        <form action={adicionarDespesaAcao}>
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
      </details>

      <details className="adm-card adm-receita">
        <summary>
          <h3>Lista de despesas ({despesas.length})</h3>
        </summary>
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
      </details>

      <details className="adm-card adm-receita">
        <summary>
          <h3>Demonstrativo em tabela</h3>
        </summary>
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
        <Tabela
          titulo="Por sabor"
          cabecalho={["Sabor", "Cookies", "Receita", "Custo"]}
          linhas={sabores.map((s) => [
            s.sabor,
            String(s.cookies),
            brl(s.receita),
            s.custo == null ? "—" : brl(s.custo),
          ])}
        />
        <TabelaQuebra titulo="Entrega × retirada" linhas={modalidade} />
        <TabelaQuebra titulo="Forma de pagamento" linhas={pagamento} />
        <TabelaQuebra titulo="Origem" linhas={origem} />
      </details>
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

function TabelaQuebra({ titulo, linhas }: { titulo: string; linhas: LinhaQuebra[] }) {
  return (
    <Tabela
      titulo={titulo}
      cabecalho={["", "Pedidos", "Faturamento", "Contribuição"]}
      linhas={linhas.map((l) => [
        ROTULOS[l.chave] ?? l.chave,
        String(l.pedidos),
        brl(l.valor),
        l.contribuicao == null ? "—" : brl(l.contribuicao),
      ])}
    />
  );
}

function Tabela({ titulo, cabecalho, linhas }: { titulo: string; cabecalho: string[]; linhas: string[][] }) {
  if (!linhas.length) return null;
  return (
    <>
      <h3 style={{ margin: "16px 0 6px", fontSize: 14 }}>{titulo}</h3>
      <div className="adm-tabela">
        <table style={{ minWidth: 420 }}>
          <thead>
            <tr>
              {cabecalho.map((c, i) => (
                <th key={i} className={i ? "num" : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                {l.map((c, j) => (
                  <td key={j} className={j ? "num" : undefined}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
