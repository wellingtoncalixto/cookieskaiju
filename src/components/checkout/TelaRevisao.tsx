"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CabecalhoEtapa, Carregando, ListaErros } from "@/components/checkout/Comum";
import { IconeWhatsApp } from "@/components/Icones";
import { loja } from "@/config/loja";
import { useCheckout, useGuardaEtapa } from "@/hooks/useCheckout";
import { brl } from "@/lib/formato";
import { textosTaxa } from "@/lib/frete";
import { linhaPagamento, linkWhatsApp, montarMensagemWhatsApp } from "@/lib/mensagem";
import { DIAS_CURTOS, dataDeIso, ddmm, diaPorExtenso } from "@/lib/tempo";
import { linhasSacola, useSacola } from "@/store/sacola";

export function TelaRevisao() {
  const router = useRouter();
  const c = useCheckout();
  const liberada = useGuardaEtapa("revisao", c);
  const itens = useSacola((s) => s.itens);
  const cabecalho = (
    <CabecalhoEtapa
      titulo="Revisar pedido"
      subtitulo="Etapa 3 de 3"
      etapa={3}
      voltarPara="/pedido/pagamento"
    />
  );

  if (!liberada || !c.situacao) {
    return (
      <>
        {cabecalho}
        <Carregando />
      </>
    );
  }

  const { pedido, resumo, situacao } = c;
  const e = pedido.endereco;
  const uf = (e.uf || loja.uf).toUpperCase();
  const linhas = linhasSacola(itens);
  const [dataIso, janelaId] = (pedido.horario ?? "|").split("|");
  const janela = loja.janelas.find((j) => j.id === janelaId);
  const data = dataIso ? dataDeIso(dataIso) : null;
  const horarioTexto = data && janela ? `${diaPorExtenso(data)} · ${janela.nome}` : "";
  const taxa = textosTaxa(resumo.taxa);
  const erros = [...c.erros.entrega.mensagens, ...c.erros.pagamento.mensagens];

  const mensagem = montarMensagemWhatsApp({
    itens: linhas.map((l) => ({ nome: l.produto.nome, quantidade: l.quantidade, preco: l.produto.preco })),
    prontaEntrega: situacao.agenda.modo === "estoque",
    teste: situacao.agenda.teste,
    horario: horarioTexto,
    endereco: e,
    taxa: resumo.taxa,
    pagamento: pedido.pagamento ?? "pix",
    troco: pedido.troco,
    cliente: { nome: pedido.nome, telefone: pedido.telefone },
    obs: pedido.obs,
  });

  return (
    <>
      {cabecalho}
      <main id="conteudo" className="col screen">
        <div className="comanda">
          <div className="hd">
            <div>
              <span className="label">Comanda</span>
              <b>Cookies Kaiju</b>
            </div>
            <div className="when">
              {data && janela ? (
                <>
                  {DIAS_CURTOS[data.getUTCDay()]} {ddmm(data)}
                  <br />
                  {janela.nome}
                </>
              ) : (
                "Sem horário"
              )}
            </div>
          </div>

          <section className="csec">
            <div className="ct">
              <h2>Cookies</h2>
              <Link href="/sacola" aria-label="Editar cookies">
                Editar
              </Link>
            </div>
            {linhas.map(({ produto: p, quantidade }) => (
              <div className="cl" key={p.slug}>
                <span className="q tnum">{quantidade}×</span>
                <span>{p.nome}</span>
                <span className="v tnum">{brl(quantidade * p.preco)}</span>
              </div>
            ))}
          </section>

          <section className="csec">
            <div className="ct">
              <h2>Entrega</h2>
              <Link href="/pedido/entrega" aria-label="Editar entrega">
                Editar
              </Link>
            </div>
            <p>{horarioTexto || "Escolha um horário"}</p>
            {situacao.agenda.modo === "estoque" && <p>Pronta-entrega (sujeito a estoque)</p>}
            <p>
              {e.rua}, {e.numero}
              {e.complemento && ` · ${e.complemento}`}
              <br />
              {e.bairro} · {e.cidade}/{uf}
              {e.cep && ` · CEP ${e.cep}`}
              {e.referencia && (
                <>
                  <br />
                  Referência: {e.referencia}
                </>
              )}
            </p>
          </section>

          <section className="csec">
            <div className="ct">
              <h2>Cliente e pagamento</h2>
              <Link href="/pedido/pagamento" aria-label="Editar cliente e pagamento">
                Editar
              </Link>
            </div>
            <p>
              {pedido.nome} · {pedido.telefone}
            </p>
            <p>{linhaPagamento(pedido.pagamento, pedido.troco)}</p>
            {pedido.obs && <p>Obs.: {pedido.obs}</p>}
          </section>

          <div className="ctot" aria-live="polite">
            <div className="r">
              <span>Subtotal</span>
              <span className="tnum">{brl(resumo.subtotal)}</span>
            </div>
            <div className="r">
              <span>Taxa de entrega</span>
              <span>{taxa.curto}</span>
            </div>
            <div className="d">{taxa.detalhe}</div>
            <div className="r g">
              <span>Total</span>
              <span className="tnum">{brl(resumo.total)}</span>
            </div>
            {resumo.taxa.valor === null && <div className="d direita">+ taxa de entrega a confirmar</div>}
          </div>
        </div>
        <p className="fine">
          O pedido é confirmado quando a Cookies Kaiju responder no WhatsApp. A taxa de entrega é estimada
          pela distância de rota e conferida pela loja.
        </p>
      </main>

      <div className="actionbar">
        <div className="in">
          <ListaErros visivel={pedido.tentou.revisao} mensagens={erros} />
          <a
            className="btn btn-primary btn-wide"
            href={linkWhatsApp(mensagem)}
            target="_blank"
            rel="noopener"
            onClick={(ev) => {
              pedido.marcarTentativa("revisao");
              if (erros.length) {
                ev.preventDefault();
                return;
              }
              pedido.definir({ mensagemEnviada: mensagem });
              setTimeout(() => router.push("/pedido/enviado"), 60);
            }}
          >
            <IconeWhatsApp />
            <span>Enviar pedido pelo WhatsApp</span>
          </a>
        </div>
      </div>
    </>
  );
}
