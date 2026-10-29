import {
  adicionarIngredienteAcao,
  alterarIngredienteAcao,
  excluirInsumoAcao,
  excluirReceitaAcao,
  removerIngredienteAcao,
  salvarFornoAcao,
  salvarInsumoAcao,
  salvarReceitaAcao,
} from "../../acoes";
import { Aviso } from "@/components/admin/Aviso";
import { brl } from "@/lib/formato";
import { energiaPorFornada, type CustoReceita, type Receita } from "@/lib/precificacao";
import {
  listarIngredientes,
  listarProdutos,
  type IngredienteAdmin,
  type ProdutoAdmin,
} from "@/server/cadastros";
import { mapaConfiguracao, parametrosForno } from "@/server/configuracao";
import { bancoConfigurado } from "@/server/db";
import { carregarPrecificacao, type DadosPrecificacao } from "@/server/precificacao";
import { exigirAdmin } from "@/server/sessao-admin";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** 1234.5 → "1.234,5" (até `casas` decimais). */
const num = (v: number, casas = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
const pct = (v: number) => `${num(v * 100, 1)}%`;
const campoNum = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));

export default async function Precificacao({ searchParams }: Props) {
  await exigirAdmin();
  if (!bancoConfigurado()) return <h1>Precificação</h1>;
  const [dados, ingredientes, produtos, cfg] = await Promise.all([
    carregarPrecificacao(),
    listarIngredientes(),
    listarProdutos(),
    mapaConfiguracao(),
  ]);
  const forno = parametrosForno(cfg);
  const porFornada = energiaPorFornada(forno);
  const sabores = dados.receitas.filter((r) => r.tipo === "sabor");
  const bases = dados.receitas.filter((r) => r.tipo === "base");

  return (
    <>
      <Aviso busca={searchParams} />
      <h1>Precificação</h1>
      <p className="adm-mute">
        Qualquer mudança aqui recalcula na hora o custo de todos os sabores. Os pedidos já feitos guardam o
        custo do dia em que foram feitos.
      </p>

      <h2>Custo por sabor</h2>
      <div className="adm-tabela">
        <table>
          <thead>
            <tr>
              <th>Receita</th>
              <th className="num">Lote</th>
              <th className="num">Por cookie</th>
              <th className="num">Custo final</th>
              <th>Produto</th>
              <th className="num">Preço</th>
              <th className="num">Lucro</th>
              <th className="num">Margem</th>
            </tr>
          </thead>
          <tbody>
            {sabores.map((r) => {
              const c = dados.custos.get(r.id)!;
              const p = produtos.find((x) => x.receitaId === r.id);
              return (
                <tr key={r.id}>
                  <td>
                    <a href={`#receita-${r.id}`}>{r.nome}</a>
                  </td>
                  <td className="num">{brl(c.total)}</td>
                  <td className="num">{brl(c.porUnidade)}</td>
                  <td className="num">
                    <b>{brl(c.final)}</b>
                  </td>
                  <td>{p ? p.nome : <span className="adm-mute">nenhum</span>}</td>
                  <td className="num">{p ? brl(p.preco) : "—"}</td>
                  <td className="num">{p ? brl(p.preco - c.final) : "—"}</td>
                  <td className="num">{p && p.preco ? pct((p.preco - c.final) / p.preco) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Receitas</h2>
      {[...bases, ...sabores].map((r) => (
        <CartaoReceita
          key={r.id}
          r={r}
          c={dados.custos.get(r.id)!}
          dados={dados}
          ingredientes={ingredientes.filter((i) => i.receitaId === r.id)}
          produto={produtos.find((p) => p.receitaId === r.id)}
        />
      ))}
      <details className="adm-card adm-receita">
        <summary>
          <h3>+ Nova receita</h3>
        </summary>
        <FormReceita />
      </details>

      <h2>Insumos</h2>
      <p className="adm-mute">
        Preço e tamanho da embalagem como você compra. O custo por unidade é calculado.
      </p>
      <div className="adm-tabela">
        <table>
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Unid.</th>
              <th className="num">Embalagem</th>
              <th className="num">Preço (R$)</th>
              <th className="num">Custo/unid.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dados.insumos.map((i) => (
              <tr key={i.id}>
                <td>
                  <input
                    form={`insumo-${i.id}`}
                    name="nome"
                    defaultValue={i.nome}
                    required
                    aria-label="Nome"
                  />
                </td>
                <td>
                  <SelectUnidade form={`insumo-${i.id}`} valor={i.unidade} />
                </td>
                <td className="num">
                  <input
                    form={`insumo-${i.id}`}
                    className="w-num"
                    name="embalagemQtd"
                    inputMode="decimal"
                    defaultValue={campoNum(i.embalagemQtd)}
                    aria-label="Tamanho da embalagem"
                  />
                </td>
                <td className="num">
                  <input
                    form={`insumo-${i.id}`}
                    className="w-num"
                    name="embalagemPreco"
                    inputMode="decimal"
                    defaultValue={campoNum(i.embalagemPreco)}
                    aria-label="Preço da embalagem"
                  />
                </td>
                <td className="num adm-mute">
                  R$ {num(i.embalagemPreco / i.embalagemQtd, 4)}/{i.unidade}
                </td>
                <td>
                  <div className="adm-acoes" style={{ marginTop: 0, flexWrap: "nowrap" }}>
                    <form id={`insumo-${i.id}`} action={salvarInsumoAcao}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className="adm-btn pequeno" type="submit">
                        Salvar
                      </button>
                    </form>
                    <form action={excluirInsumoAcao}>
                      <input type="hidden" name="id" value={i.id} />
                      <button
                        className="adm-btn pequeno perigo"
                        type="submit"
                        aria-label={`Excluir ${i.nome}`}
                      >
                        ×
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <input
                  form="insumo-novo"
                  name="nome"
                  placeholder="Novo insumo"
                  required
                  aria-label="Nome do novo insumo"
                />
              </td>
              <td>
                <SelectUnidade form="insumo-novo" valor="g" />
              </td>
              <td className="num">
                <input
                  form="insumo-novo"
                  className="w-num"
                  name="embalagemQtd"
                  inputMode="decimal"
                  placeholder="1000"
                  aria-label="Tamanho da embalagem"
                />
              </td>
              <td className="num">
                <input
                  form="insumo-novo"
                  className="w-num"
                  name="embalagemPreco"
                  inputMode="decimal"
                  placeholder="0,00"
                  aria-label="Preço da embalagem"
                />
              </td>
              <td></td>
              <td>
                <form id="insumo-novo" action={salvarInsumoAcao}>
                  <button className="adm-btn pequeno primario" type="submit">
                    Adicionar
                  </button>
                </form>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Forno elétrico</h2>
      <form action={salvarFornoAcao} className="adm-card">
        <div className="adm-campos dois">
          <label className="adm-campo">
            <span>Potência (W)</span>
            <input name="forno_potencia_w" inputMode="decimal" defaultValue={campoNum(forno.potenciaW)} />
          </label>
          <label className="adm-campo">
            <span>Minutos por fornada</span>
            <input
              name="forno_minutos_fornada"
              inputMode="decimal"
              defaultValue={campoNum(forno.minutosFornada)}
            />
          </label>
          <label className="adm-campo">
            <span>Cookies por fornada</span>
            <input
              name="forno_cookies_fornada"
              inputMode="decimal"
              defaultValue={campoNum(forno.cookiesFornada)}
            />
          </label>
          <label className="adm-campo">
            <span>Preço do kWh (R$)</span>
            <input name="energia_kwh" inputMode="decimal" defaultValue={campoNum(forno.precoKwh)} />
          </label>
        </div>
        <p className="adm-mute">
          {porFornada == null
            ? "Preencha para somar a energia ao custo."
            : `Energia por fornada: ${brl(porFornada)}.`}
        </p>
        <div className="adm-acoes">
          <button className="adm-btn primario" type="submit">
            Salvar forno
          </button>
        </div>
      </form>
    </>
  );
}

function SelectUnidade({ form, valor }: { form: string; valor: string }) {
  return (
    <select form={form} name="unidade" defaultValue={valor} aria-label="Unidade">
      <option value="g">g</option>
      <option value="ml">ml</option>
      <option value="un">un</option>
    </select>
  );
}

function FormReceita({ r }: { r?: Receita }) {
  return (
    <form action={salvarReceitaAcao}>
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="adm-campos dois">
        <label className="adm-campo">
          <span>Nome</span>
          <input name="nome" defaultValue={r?.nome} required />
        </label>
        <label className="adm-campo">
          <span>Tipo</span>
          <select name="tipo" defaultValue={r?.tipo ?? "sabor"}>
            <option value="sabor">Sabor (vira cookie)</option>
            <option value="base">Base (ex.: massa, entra em outras receitas)</option>
          </select>
        </label>
        <label className="adm-campo">
          <span>Rendimento</span>
          <input
            name="rendimento"
            inputMode="decimal"
            defaultValue={campoNum(r?.rendimento ?? 15)}
            required
          />
        </label>
        <label className="adm-campo">
          <span>Unidade do rendimento</span>
          <select name="unidadeRendimento" defaultValue={r?.unidadeRendimento ?? "un"}>
            <option value="un">cookies (un)</option>
            <option value="g">gramas (g)</option>
          </select>
        </label>
        <label className="adm-campo">
          <span>Mão de obra (%) — só nos sabores</span>
          <input
            name="maoDeObraPct"
            inputMode="decimal"
            defaultValue={campoNum(r ? r.maoDeObraPct * 100 : 30)}
          />
        </label>
        <label className="adm-check">
          <input type="checkbox" name="usaForno" defaultChecked={r?.usaForno ?? true} />
          Vai ao forno (soma a energia)
        </label>
      </div>
      <div className="adm-acoes">
        <button className="adm-btn primario" type="submit">
          {r ? "Salvar receita" : "Criar receita"}
        </button>
      </div>
    </form>
  );
}

function CartaoReceita({
  r,
  c,
  dados,
  ingredientes,
  produto,
}: {
  r: Receita;
  c: CustoReceita;
  dados: DadosPrecificacao;
  ingredientes: IngredienteAdmin[];
  produto?: ProdutoAdmin;
}) {
  const unidade = r.unidadeRendimento === "g" ? "g" : "cookie";
  return (
    <details className="adm-card adm-receita" id={`receita-${r.id}`}>
      <summary>
        <h3>
          {r.nome} <span className="adm-mute">· {r.tipo === "base" ? "base" : "sabor"}</span>
        </h3>
        <b className="tnum">
          {r.tipo === "base" ? `R$ ${num(c.final, 4)}/${unidade}` : `${brl(c.final)}/cookie`}
        </b>
      </summary>

      {c.avisos.length > 0 && <p className="adm-aviso erro">{c.avisos.join(" · ")}</p>}

      <div className="adm-tabela">
        <table>
          <thead>
            <tr>
              <th>Ingrediente</th>
              <th className="num">Quantidade</th>
              <th className="num">Custo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ingredientes.map((ing, n) => {
              const linha = c.linhas.find((l) => l.indice === n);
              const nome = ing.insumoId
                ? dados.insumos.find((i) => i.id === ing.insumoId)?.nome
                : dados.receitas.find((x) => x.id === ing.subReceitaId)?.nome;
              return (
                <tr key={ing.id}>
                  <td>
                    {nome}
                    {ing.subReceitaId && <span className="adm-mute"> (receita)</span>}
                  </td>
                  <td className="num">
                    <form
                      action={alterarIngredienteAcao}
                      style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
                    >
                      <input type="hidden" name="id" value={ing.id} />
                      <input type="hidden" name="receitaId" value={r.id} />
                      <input
                        className="w-num"
                        name="quantidade"
                        inputMode="decimal"
                        defaultValue={campoNum(ing.quantidade)}
                        aria-label={`Quantidade de ${nome}`}
                      />
                      <span className="adm-mute">{linha?.unidade}</span>
                      <button className="adm-btn pequeno" type="submit">
                        OK
                      </button>
                    </form>
                  </td>
                  <td className="num">{linha ? brl(linha.custo) : "—"}</td>
                  <td>
                    <form action={removerIngredienteAcao}>
                      <input type="hidden" name="id" value={ing.id} />
                      <input type="hidden" name="receitaId" value={r.id} />
                      <button className="adm-btn pequeno perigo" type="submit" aria-label={`Remover ${nome}`}>
                        ×
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form action={adicionarIngredienteAcao} className="adm-acoes" style={{ alignItems: "center" }}>
        <input type="hidden" name="receitaId" value={r.id} />
        <select name="item" required aria-label="Ingrediente" style={{ maxWidth: 260 }} defaultValue="">
          <option value="" disabled>
            Adicionar ingrediente…
          </option>
          <optgroup label="Insumos">
            {dados.insumos.map((i) => (
              <option key={i.id} value={`i:${i.id}`}>
                {i.nome} ({i.unidade})
              </option>
            ))}
          </optgroup>
          <optgroup label="Receitas base">
            {dados.receitas
              .filter((x) => x.tipo === "base" && x.id !== r.id)
              .map((x) => (
                <option key={x.id} value={`r:${x.id}`}>
                  {x.nome} ({x.unidadeRendimento})
                </option>
              ))}
          </optgroup>
        </select>
        <input
          name="quantidade"
          inputMode="decimal"
          placeholder="Qtd."
          className="w-num"
          required
          aria-label="Quantidade"
          style={{ width: 96 }}
        />
        <button className="adm-btn pequeno primario" type="submit">
          Adicionar
        </button>
      </form>

      <div className="adm-resumo">
        <div>
          <span>Ingredientes do lote</span>
          <b>{brl(c.ingredientes)}</b>
        </div>
        {r.usaForno && (
          <div>
            <span>Energia ({c.fornadas} fornadas)</span>
            <b>{brl(c.energia)}</b>
          </div>
        )}
        <div>
          <span>
            Rendimento: {num(r.rendimento)} {r.unidadeRendimento}
          </span>
          <b>{r.tipo === "base" ? `R$ ${num(c.porUnidade, 4)}/${unidade}` : `${brl(c.porUnidade)}/cookie`}</b>
        </div>
        {r.tipo === "sabor" && (
          <div>
            <span>Final (+{num(r.maoDeObraPct * 100, 1)}% mão de obra)</span>
            <b>{brl(c.final)}</b>
          </div>
        )}
        {produto && (
          <div>
            <span>
              {produto.nome}: {brl(produto.preco)}
            </span>
            <b>
              {brl(produto.preco - c.final)} ({pct((produto.preco - c.final) / produto.preco)})
            </b>
          </div>
        )}
      </div>

      <details style={{ marginTop: 12 }}>
        <summary className="adm-mute">Editar receita</summary>
        <FormReceita r={r} />
        <form action={excluirReceitaAcao} className="adm-acoes">
          <input type="hidden" name="id" value={r.id} />
          <button className="adm-btn perigo pequeno" type="submit">
            Excluir receita
          </button>
        </form>
      </details>
    </details>
  );
}
