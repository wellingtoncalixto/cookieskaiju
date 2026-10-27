"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CabecalhoEtapa, Carregando, ListaErros } from "@/components/checkout/Comum";
import { IconeWhatsApp } from "@/components/Icones";
import { loja } from "@/config/loja";
import { REGISTRO_PEDIDOS_ATIVO } from "@/config/registro";
import { useCheckout, useGuardaEtapa } from "@/hooks/useCheckout";
import { useConferenciaEstoque } from "@/hooks/useConferenciaEstoque";
import { brl } from "@/lib/formato";
import { textosTaxa } from "@/lib/frete";
import { linhaPagamento, linkWhatsApp, montarMensagemWhatsApp } from "@/lib/mensagem";
import { CHAVE_AGORA, horaDe, textoHorario } from "@/lib/agenda";
import { freteEmAndamento } from "@/lib/agendar-frete";
import { gerarIdPedido } from "@/lib/id-pedido";
import {
  assinaturaConteudo,
  registrarComTentativas,
  reservarNumero,
  type EntradaCliente,
} from "@/lib/registro-cliente";
import { DIAS_CURTOS, dataDeIso, ddmm } from "@/lib/tempo";
import { usePedido } from "@/store/pedido";
import { linhasSacola, useSacola } from "@/store/sacola";

export function TelaRevisao() {
  const router = useRouter();
  const c = useCheckout();
  const liberada = useGuardaEtapa("revisao", c);
  const itens = useSacola((s) => s.itens);
  const errosEstoque = useConferenciaEstoque(itens);

  // Resumo para o painel da loja: sem nome, telefone, endereço nem mensagem.
  const p = c.pedido;
  const retiradaEscolhida = p.modalidade === "retirada";
  const resumoRegistro: Omit<EntradaCliente, "id" | "cotacao"> = {
    modalidade: p.modalidade,
    horario: p.horario ?? "",
    itens: linhasSacola(itens).map((l) => ({ slug: l.produto.slug, quantidade: l.quantidade })),
    pagamento: p.pagamento ?? "pix",
    cidade: retiradaEscolhida ? "" : p.endereco.cidade,
    cep: retiradaEscolhida ? "" : p.endereco.cep,
  };
  const conteudo = assinaturaConteudo(resumoRegistro);

  // Chave interna estável enquanto o pedido não mudar (mesma chave = nunca duplica no banco) e número do pedido
  // (#57) reservado no servidor. Se a sacola mudar antes do envio, o mesmo número passa para a chave nova.
  useEffect(() => {
    if (!REGISTRO_PEDIDOS_ATIVO || !liberada) return;
    const atual = usePedido.getState();
    let chave = atual.idPedido;
    let anterior: string | undefined;
    if (!chave || atual.idConteudo !== conteudo) {
      anterior = chave && atual.registro === "inativo" ? chave : undefined;
      chave = gerarIdPedido();
      atual.definir({
        idPedido: chave,
        idConteudo: conteudo,
        registro: "inativo",
        numeroPedido: anterior ? atual.numeroPedido : null,
      });
    }
    if (usePedido.getState().numeroPedido != null && !anterior) return;
    const reservada = chave;
    void reservarNumero(reservada, anterior).then((numero) => {
      if (numero != null && usePedido.getState().idPedido === reservada)
        usePedido.getState().definir({ numeroPedido: numero });
    });
  }, [liberada, conteudo]);

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
  const paraAgora = pedido.horario === CHAVE_AGORA;
  const [dataIso, janelaId] = paraAgora ? ["", ""] : (pedido.horario ?? "|").split("|");
  const janela = loja.janelas.find((j) => j.id === janelaId);
  const data = dataIso ? dataDeIso(dataIso) : null;
  const horarioTexto = textoHorario(situacao.agenda, pedido.horario);
  const taxa = textosTaxa(resumo.taxa);
  const retirada = pedido.modalidade === "retirada";
  const erros = [...errosEstoque, ...c.erros.entrega.mensagens, ...c.erros.pagamento.mensagens];

  const idPedido = REGISTRO_PEDIDOS_ATIVO ? (pedido.idPedido ?? undefined) : undefined;
  const numeroPedido = idPedido && pedido.numeroPedido != null ? `#${pedido.numeroPedido}` : undefined;
  const mensagem = montarMensagemWhatsApp({
    id: numeroPedido,
    itens: linhas.map((l) => ({ nome: l.produto.nome, quantidade: l.quantidade, preco: l.produto.preco })),
    modalidade: pedido.modalidade,
    teste: situacao.agenda.teste,
    horario: horarioTexto,
    endereco: e,
    taxa: resumo.taxa,
    pagamento: pedido.pagamento ?? "pix",
    troco: pedido.troco,
    cliente: { nome: pedido.nome },
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
              {numeroPedido && <span className="label id-pedido">Pedido {numeroPedido}</span>}
            </div>
            <div className="when">
              {paraAgora ? (
                <>
                  Hoje
                  <br />
                  {situacao.agenda.previsao
                    ? `${horaDe(situacao.agenda.previsao.de)} a ${horaDe(situacao.agenda.previsao.ate)}`
                    : ""}
                </>
              ) : data && janela ? (
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
              <h2>{retirada ? "Retirada" : "Entrega"}</h2>
              <Link href="/pedido/entrega" aria-label={retirada ? "Editar retirada" : "Editar entrega"}>
                Editar
              </Link>
            </div>
            <p>{horarioTexto || "Escolha um horário"}</p>
            {retirada ? (
              <p>Local combinado com a loja pelo WhatsApp</p>
            ) : (
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
            )}
          </section>

          <section className="csec">
            <div className="ct">
              <h2>Cliente e pagamento</h2>
              <Link href="/pedido/pagamento" aria-label="Editar cliente e pagamento">
                Editar
              </Link>
            </div>
            <p>{pedido.nome}</p>
            <p>{linhaPagamento(pedido.pagamento, pedido.troco, pedido.modalidade)}</p>
            {pedido.obs && <p>Obs.: {pedido.obs}</p>}
          </section>

          <div className="ctot" aria-live="polite">
            <div className="r">
              <span>Subtotal</span>
              <span className="tnum">{brl(resumo.subtotal)}</span>
            </div>
            {!retirada && (
              <div className="r">
                <span>Taxa de entrega</span>
                <span>{taxa.curto}</span>
              </div>
            )}
            {taxa.detalhe && <div className="d">{taxa.detalhe}</div>}
            <div className="r g">
              <span>Total</span>
              <span className="tnum">{brl(resumo.total)}</span>
            </div>
            {resumo.taxa.valor === null && <div className="d direita">+ taxa de entrega a confirmar</div>}
          </div>
        </div>
        <p className="fine">
          O pedido é confirmado quando a Cookies Kaiju responder no WhatsApp.
          {retirada
            ? " O local de retirada é combinado na confirmação."
            : " A taxa de entrega é estimada pela distância de rota e conferida pela loja."}
        </p>
      </main>

      <div className="actionbar">
        <div className="in">
          <ListaErros visivel={pedido.tentou.revisao || errosEstoque.length > 0} mensagens={erros} />
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
              // Registro em segundo plano: o WhatsApp abre na hora, sem esperar o registro.
              const situacaoRegistro = usePedido.getState().registro; // estado atual (não o do último render)
              if (idPedido && (situacaoRegistro === "inativo" || situacaoRegistro === "falhou")) {
                usePedido.getState().definir({ registro: "enviando" });
                const entrada = { ...resumoRegistro, id: idPedido };
                void (async () => {
                  // Se o frete ainda está sendo calculado, espera um pouco pela cotação (sem segurar o WhatsApp).
                  const cotacao = await cotacaoQuandoPronta();
                  await registrarComTentativas({ ...entrada, cotacao }, (estado) =>
                    usePedido.getState().definir({ registro: estado }),
                  );
                })();
              }
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

/** Cotação de frete assinada; se o cálculo estiver agendado ou em andamento, espera até 10 segundos. */
async function cotacaoQuandoPronta(): Promise<string | undefined> {
  for (let i = 0; i < 20 && freteEmAndamento(); i++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  const frete = usePedido.getState().frete;
  return frete.status === "ok" ? frete.cotacao : undefined;
}
