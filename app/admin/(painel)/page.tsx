import Link from "next/link";
import { definirEstoqueAcao, definirModoLoja, definirStatusPedido } from "../acoes";
import { AtualizarSozinho } from "@/components/admin/AtualizarSozinho";
import { Aviso } from "@/components/admin/Aviso";
import { loja } from "@/config/loja";
import { CHAVE_AGORA, calcularAgenda, horaDe, textosAgenda, type ModoLoja } from "@/lib/agenda";
import { brl } from "@/lib/formato";
import { DIAS, dataDeIso, ddmm, isoData, paredeSP } from "@/lib/tempo";
import { bancoConfigurado } from "@/server/db";
import { estoqueAtual } from "@/server/estoque";
import { lerModoLoja } from "@/server/modo-loja";
import { pedidosDaOperacao, type PedidoOperacao, type StatusPedido } from "@/server/pedidos";
import { exigirAdmin } from "@/server/sessao-admin";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const MODOS: { modo: ModoLoja; rotulo: string }[] = [
  { modo: "automatico", rotulo: "Automático" },
  { modo: "aberto", rotulo: "Aberto" },
  { modo: "fechado", rotulo: "Fechado" },
];

const ROTULO_STATUS: Record<StatusPedido, string> = {
  pendente: "Pendente",
  concluido: "Concluído",
  cancelado: "Cancelado",
  abandonado: "Abandonado",
};

const PAGAMENTO: Record<string, string> = {
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
};

/** Dados da tela no instante da requisição. */
async function carregar() {
  const agora = Date.now();
  const hoje = isoData(paredeSP(agora));
  const [modo, pedidos, estoque] = await Promise.all([
    lerModoLoja(),
    bancoConfigurado() ? pedidosDaOperacao(hoje) : Promise.resolve([]),
    bancoConfigurado() ? estoqueAtual() : Promise.resolve([]),
  ]);
  const agenda = calcularAgenda(agora, { modoLoja: modo });
  return { hoje, modo, pedidos, estoque, agenda, textos: textosAgenda(agenda, agora) };
}

export default async function Operacao({ searchParams }: Props) {
  await exigirAdmin();
  const { hoje, modo, pedidos, estoque, agenda, textos } = await carregar();
  const aberto = agenda.modo === "aberta";

  const porDia = new Map<string, PedidoOperacao[]>();
  for (const p of pedidos) porDia.set(p.entregaData!, [...(porDia.get(p.entregaData!) ?? []), p]);

  return (
    <>
      <AtualizarSozinho />
      <Aviso busca={searchParams} />

      <h1>Operação</h1>
      <section className="adm-card" aria-labelledby="t-delivery">
        <p className={`adm-estado ${aberto ? "aberto" : ""}`} id="t-delivery" style={{ margin: 0 }}>
          Delivery {aberto ? "aberto" : "fechado"} agora
        </p>
        <p className="adm-mute" style={{ margin: "6px 0 0" }}>
          {modo === "automatico" ? "Seguindo o horário (sáb. e dom., 13h às 18h). " : ""}
          {textos.texto}
        </p>
        <form action={definirModoLoja} className="adm-modo" aria-label="Abrir ou fechar o delivery">
          {MODOS.map((m) => (
            <button key={m.modo} type="submit" name="modo" value={m.modo} aria-pressed={modo === m.modo}>
              {m.rotulo}
            </button>
          ))}
        </form>
        <p className="adm-mute" style={{ margin: "8px 0 0" }}>
          Fechado: o site avisa e só deixa agendar. Aberto: libera pedido para hoje mesmo fora do horário.
        </p>
      </section>

      <h2>Estoque</h2>
      <section className="adm-card" aria-label="Estoque por sabor">
        <p className="adm-mute" style={{ margin: "0 0 8px" }}>
          Unidades prontas. Cada pedido do site reserva as dele; cancelar devolve. Em zero, o site mostra
          esgotado. Vazio = não controlar.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {estoque.map((e) => (
            <form
              key={e.id}
              action={definirEstoqueAcao}
              className="adm-acoes"
              style={{ marginTop: 0, alignItems: "center" }}
            >
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="nome" value={e.nome} />
              <span style={{ flex: "1 1 140px" }}>
                {e.nome}
                {e.estoque === 0 && (
                  <span className="adm-selo cancelado" style={{ marginLeft: 8 }}>
                    Esgotado
                  </span>
                )}
              </span>
              <input
                name="estoque"
                type="number"
                min={0}
                step={1}
                defaultValue={e.estoque ?? ""}
                aria-label={`Estoque de ${e.nome}`}
                style={{ width: 96 }}
              />
              <button className="adm-btn pequeno" type="submit">
                Salvar
              </button>
            </form>
          ))}
        </div>
      </section>

      <div
        className="adm-acoes"
        style={{ justifyContent: "space-between", alignItems: "center", marginTop: 28 }}
      >
        <h2 style={{ margin: 0 }}>Pedidos de hoje e agendados</h2>
        <Link className="adm-btn primario pequeno" href="/admin/pedidos/novo">
          + Novo pedido
        </Link>
      </div>
      {pedidos.length === 0 && <p className="adm-mute">Nenhum pedido de hoje em diante.</p>}
      {[...porDia].map(([data, lista]) => (
        <section key={data} aria-label={tituloDia(data, hoje)}>
          <h3 className="adm-dia">
            {tituloDia(data, hoje)} ·{" "}
            {lista.filter((p) => p.status !== "cancelado" && p.status !== "abandonado").length} pedido(s)
          </h3>
          {lista.map((p) => (
            <Pedido key={p.id} p={p} hoje={hoje} />
          ))}
        </section>
      ))}
    </>
  );
}

function tituloDia(data: string, hoje: string) {
  const d = dataDeIso(data);
  const nome = DIAS[d.getUTCDay()];
  return data === hoje ? `Hoje, ${ddmm(d)}` : `${nome[0].toUpperCase()}${nome.slice(1)}, ${ddmm(d)}`;
}

function textoFaixa(p: PedidoOperacao) {
  if (p.entregaFaixa === CHAVE_AGORA)
    return `Para hoje (${loja.agenda.prazoMinimoMin} a ${loja.agenda.prazoMaximoMin} min)`;
  return loja.janelas.find((j) => j.id === p.entregaFaixa)?.nome ?? p.entregaFaixa ?? "";
}

function Pedido({ p, hoje }: { p: PedidoOperacao; hoje: string }) {
  const rotulo = p.numero != null ? `#${p.numero}` : p.id;
  const feitoEm = paredeSP(p.criadoEm);
  const feito = isoData(feitoEm) === hoje ? horaDe(p.criadoEm) : `${ddmm(feitoEm)} às ${horaDe(p.criadoEm)}`;
  const entrega =
    p.modalidade === "retirada"
      ? "Retirada"
      : p.frete == null
        ? "A confirmar"
        : p.frete === 0
          ? "Grátis"
          : brl(p.frete);
  return (
    <article className={`adm-card adm-pedido ${p.status}`}>
      <div className="cab">
        <span className="adm-codigo">{rotulo}</span>
        <span>
          {p.manual && (
            <span className="adm-selo" style={{ marginRight: 6 }} title="Lançado no admin">
              Manual
            </span>
          )}
          {p.semEstoque && (
            <span
              className="adm-selo cancelado"
              style={{ marginRight: 6 }}
              title="Chegou sem unidades suficientes"
            >
              Sem estoque
            </span>
          )}
          <span className={`adm-selo ${p.status}`}>{ROTULO_STATUS[p.status]}</span>
        </span>
      </div>
      <div className="adm-mute">
        {p.modalidade === "retirada" ? "Retirada" : `Entrega${p.cidade ? ` · ${p.cidade}` : ""}`} ·{" "}
        {textoFaixa(p)}
        <br />
        Feito às {feito}
        {p.pagamento ? ` · ${PAGAMENTO[p.pagamento] ?? p.pagamento}` : ""}
      </div>
      <ul className="adm-itens">
        {p.itens.map((i, n) => (
          <li key={n}>
            <span>
              {i.quantidade}× {i.nome}
            </span>
            <span className="tnum">{brl(i.quantidade * i.preco)}</span>
          </li>
        ))}
      </ul>
      <div className="adm-valores">
        <div>
          <span>Cookies</span>
          <span className="tnum">{brl(p.receita)}</span>
        </div>
        <div>
          <span>Entrega</span>
          <span className="tnum">{entrega}</span>
        </div>
        <div className="total">
          <span>Total{p.frete == null && p.modalidade === "entrega" ? " (sem entrega)" : ""}</span>
          <span className="tnum">{brl(p.total)}</span>
        </div>
      </div>
      <form action={definirStatusPedido} className="adm-status" aria-label={`Status do pedido ${rotulo}`}>
        <input type="hidden" name="pedido" value={p.id} />
        {(Object.keys(ROTULO_STATUS) as StatusPedido[])
          .filter((s) => s !== p.status)
          .map((s) => (
            <button key={s} className="adm-btn pequeno" type="submit" name="status" value={s}>
              {s === "pendente" ? "Voltar a pendente" : `Marcar ${ROTULO_STATUS[s].toLowerCase()}`}
            </button>
          ))}
      </form>
    </article>
  );
}
