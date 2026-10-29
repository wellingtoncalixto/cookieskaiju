import Link from "next/link";
import { notFound } from "next/navigation";
import { aplicarNotaAcao, descartarNotaAcao } from "../../../acoes";
import { Aviso } from "@/components/admin/Aviso";
import { brl } from "@/lib/formato";
import { isoData, paredeSP } from "@/lib/tempo";
import { obterBanco } from "@/server/db";
import { CATEGORIAS_DESPESA } from "@/server/financeiro";
import { obterNota } from "@/server/notas";
import { exigirAdmin } from "@/server/sessao-admin";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const campoNum = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));

export default async function ConferirNota({ params, searchParams }: Props) {
  await exigirAdmin();
  const n = Number((await params).id);
  if (!Number.isInteger(n)) notFound();
  const [nota, insumos] = await Promise.all([
    obterNota(n),
    obterBanco().consulta<{ id: number; nome: string; unidade: string }>(
      "select id, nome, unidade from insumos order by nome",
    ),
  ]);
  if (!nota) notFound();
  const editavel = nota.status === "rascunho";
  const somaItens = nota.itens.reduce((s, i) => s + i.valorTotal, 0);
  const hoje = isoData(paredeSP(nota.criadoEm));

  return (
    <>
      <Aviso busca={searchParams} />
      <p style={{ marginTop: 16 }}>
        <Link href="/admin/compras">← Compras</Link>
      </p>
      <h1>{nota.fornecedor || "Nota de compra"}</h1>
      <p className="adm-mute">
        {nota.arquivoNome} ·{" "}
        {editavel ? "confira e corrija o que for preciso antes de aplicar" : `nota ${nota.status}`}
      </p>
      {nota.observacao && <p className="adm-aviso erro">Observação da leitura: {nota.observacao}</p>}

      <form action={aplicarNotaAcao}>
        <input type="hidden" name="id" value={nota.id} />
        <fieldset disabled={!editavel} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="adm-card">
            <div className="adm-campos dois">
              <label className="adm-campo">
                <span>Fornecedor</span>
                <input name="fornecedor" defaultValue={nota.fornecedor} maxLength={120} />
              </label>
              <label className="adm-campo">
                <span>Data da compra</span>
                <input type="date" name="data" defaultValue={nota.data ?? hoje} required />
              </label>
              <label className="adm-campo">
                <span>Total pago (R$) — vira a despesa</span>
                <input
                  name="total"
                  inputMode="decimal"
                  defaultValue={campoNum(nota.total ?? somaItens)}
                  required
                />
              </label>
              <label className="adm-campo">
                <span>Categoria da despesa</span>
                <select name="categoria" defaultValue={nota.categoria}>
                  {CATEGORIAS_DESPESA.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="adm-mute" style={{ marginBottom: 0 }}>
              Soma dos itens lidos: {brl(somaItens)}
              {nota.total != null &&
                Math.abs(nota.total - somaItens) > 0.05 &&
                " (diferente do total: confira descontos)"}
            </p>
          </div>

          <h2>Itens</h2>
          <p className="adm-mute">
            Quantidade = quantas embalagens; Embalagem = conteúdo de UMA embalagem. O preço do insumo passa a
            ser Valor ÷ Quantidade. Escolha “Não é insumo” para itens que só entram na despesa.
          </p>
          <div className="adm-tabela">
            <table style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Item da nota</th>
                  <th className="num">Qtd.</th>
                  <th className="num">Embalagem</th>
                  <th className="num">Valor (R$)</th>
                  <th>Insumo</th>
                  <th>Atualizar preço</th>
                </tr>
              </thead>
              <tbody>
                {nota.itens.map((i) => {
                  const c = (k: string) => `item-${i.id}-${k}`;
                  return (
                    <tr key={i.id}>
                      <td>
                        <input type="hidden" name="item" value={i.id} />
                        <input name={c("descricao")} defaultValue={i.descricao} aria-label="Descrição" />
                      </td>
                      <td className="num">
                        <input
                          name={c("quantidade")}
                          className="w-num"
                          inputMode="decimal"
                          defaultValue={campoNum(i.quantidade)}
                          aria-label="Quantidade"
                          style={{ width: 70 }}
                        />
                      </td>
                      <td className="num">
                        <span style={{ display: "inline-flex", gap: 4 }}>
                          <input
                            name={c("tamanho")}
                            className="w-num"
                            inputMode="decimal"
                            defaultValue={campoNum(i.tamanhoEmbalagem)}
                            aria-label="Tamanho da embalagem"
                            style={{ width: 80 }}
                          />
                          <select
                            name={c("unidade")}
                            defaultValue={i.unidade ?? ""}
                            aria-label="Unidade"
                            style={{ width: 64 }}
                          >
                            <option value="">—</option>
                            <option value="g">g</option>
                            <option value="ml">ml</option>
                            <option value="un">un</option>
                          </select>
                        </span>
                      </td>
                      <td className="num">
                        <input
                          name={c("valor")}
                          className="w-num"
                          inputMode="decimal"
                          defaultValue={campoNum(i.valorTotal)}
                          aria-label="Valor"
                          style={{ width: 90 }}
                        />
                      </td>
                      <td>
                        <select
                          name={c("insumo")}
                          defaultValue={i.insumoId ?? ""}
                          aria-label="Insumo"
                          style={{ minWidth: 180 }}
                        >
                          <option value="">Não é insumo</option>
                          <option value="novo">+ Criar insumo com este nome</option>
                          {insumos.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.nome} ({x.unidade})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <label className="adm-check">
                          <input type="checkbox" name={c("atualizar")} defaultChecked={i.atualizarPreco} />
                          Sim
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {editavel && (
            <div className="adm-acoes">
              <button className="adm-btn primario" type="submit">
                Aplicar nota
              </button>
            </div>
          )}
        </fieldset>
      </form>
      {editavel && (
        <form action={descartarNotaAcao} className="adm-acoes">
          <input type="hidden" name="id" value={nota.id} />
          <button className="adm-btn perigo pequeno" type="submit">
            Descartar nota
          </button>
        </form>
      )}
    </>
  );
}
