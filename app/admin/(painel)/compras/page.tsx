import Link from "next/link";
import { lerNotaAcao } from "../../acoes";
import { Aviso } from "@/components/admin/Aviso";
import { EnviarNota } from "@/components/admin/EnviarNota";
import { brl } from "@/lib/formato";
import { bancoConfigurado } from "@/server/db";
import { listarNotas } from "@/server/notas";
import { exigirAdmin } from "@/server/sessao-admin";

// A leitura da nota pela IA pode levar até ~1 minuto.
export const maxDuration = 120;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const SITUACAO = { rascunho: "Conferir", aplicada: "Aplicada", descartada: "Descartada" } as const;
const dataBr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

export default async function Compras({ searchParams }: Props) {
  await exigirAdmin();
  const notas = bancoConfigurado() ? await listarNotas() : [];
  return (
    <>
      <Aviso busca={searchParams} />
      <h1>Compras</h1>
      <p className="adm-mute">
        Envie a foto ou o PDF da nota de uma compra da loja. A IA lê os itens, sugere o insumo de cada um e
        você confere antes de aplicar: os preços dos insumos são atualizados (e os custos dos sabores
        recalculados) e o total vira uma despesa no financeiro.
      </p>
      {!process.env.ANTHROPIC_API_KEY && (
        <p className="adm-aviso erro">
          Leitura de notas não configurada: falta a variável ANTHROPIC_API_KEY na Vercel.
        </p>
      )}
      <EnviarNota acao={lerNotaAcao} />

      <h2>Notas enviadas</h2>
      <div className="adm-tabela">
        <table>
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>Data</th>
              <th className="num">Itens</th>
              <th className="num">Total</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {notas.length === 0 && (
              <tr>
                <td colSpan={5} className="adm-mute">
                  Nenhuma nota ainda.
                </td>
              </tr>
            )}
            {notas.map((n) => (
              <tr key={n.id}>
                <td>
                  <Link href={`/admin/compras/${n.id}`}>
                    {n.fornecedor || n.arquivoNome || `Nota ${n.id}`}
                  </Link>
                </td>
                <td>{dataBr(n.data)}</td>
                <td className="num">{n.itens}</td>
                <td className="num">{n.total == null ? "—" : brl(n.total)}</td>
                <td>
                  <span
                    className={`adm-selo ${n.status === "rascunho" ? "pendente" : n.status === "aplicada" ? "concluido" : "cancelado"}`}
                  >
                    {SITUACAO[n.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
