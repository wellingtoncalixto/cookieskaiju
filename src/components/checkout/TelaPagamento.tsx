"use client";

import { useRouter } from "next/navigation";
import { AvisoPrivacidade } from "@/components/Basicos";
import { CabecalhoEtapa, Carregando, ListaErros, TotalAcao } from "@/components/checkout/Comum";
import { loja } from "@/config/loja";
import { useCheckout, useGuardaEtapa } from "@/hooks/useCheckout";
import { mascaraTelefone } from "@/lib/formato";

export function TelaPagamento() {
  const router = useRouter();
  const c = useCheckout();
  const liberada = useGuardaEtapa("pagamento", c);
  const { pedido, resumo, erros } = c;
  const tentou = pedido.tentou.pagamento;
  const invalido = (campo: string) => (tentou && erros.pagamento.campos.includes(campo)) || undefined;
  const cabecalho = (
    <CabecalhoEtapa
      titulo="Dados e pagamento"
      subtitulo="Etapa 2 de 3"
      etapa={2}
      voltarPara="/pedido/entrega"
    />
  );

  if (!liberada) {
    return (
      <>
        {cabecalho}
        <Carregando />
      </>
    );
  }

  return (
    <>
      {cabecalho}
      <main id="conteudo">
        <form className="col screen" noValidate autoComplete="off" onSubmit={(e) => e.preventDefault()}>
          <section className="block" aria-labelledby="t-dados">
            <div className="block-head">
              <h2 id="t-dados">Seus dados</h2>
            </div>
            <AvisoPrivacidade variante="dados" />
            <div className="grid6">
              <div className="f s3">
                <label htmlFor="nome">Nome</label>
                <input
                  id="nome"
                  className="input"
                  type="text"
                  autoComplete="name"
                  value={pedido.nome}
                  aria-invalid={invalido("nome")}
                  onChange={(e) => pedido.definir({ nome: e.target.value })}
                />
              </div>
              <div className="f s3">
                <label htmlFor="telefone">WhatsApp</label>
                <input
                  id="telefone"
                  className="input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="(19) 99999-9999"
                  maxLength={16}
                  value={pedido.telefone}
                  aria-invalid={invalido("telefone")}
                  onChange={(e) => pedido.definir({ telefone: mascaraTelefone(e.target.value) })}
                />
              </div>
            </div>
          </section>

          <section className="block" aria-labelledby="t-pagamento">
            <div className="block-head">
              <h2 id="t-pagamento">Pagamento na entrega</h2>
            </div>
            <p className="hint">
              Nada é cobrado pelo site. A forma escolhida vai junto na mensagem do pedido.
            </p>
            <fieldset className="pay" data-invalido={invalido("pagamento")}>
              <legend className="sr-only">Forma de pagamento</legend>
              {loja.pagamentos.map((p) => (
                <label className="chip" key={p.id}>
                  <input
                    type="radio"
                    name="pagamento"
                    value={p.id}
                    checked={pedido.pagamento === p.id}
                    onChange={() => pedido.definir({ pagamento: p.id })}
                  />
                  <span>
                    {p.nome}
                    <em>{p.descricao}</em>
                  </span>
                </label>
              ))}
            </fieldset>
            {pedido.pagamento === "dinheiro" && (
              <div className="grid6">
                <div className="f s3">
                  <label htmlFor="troco">
                    Troco para <small>(opcional)</small>
                  </label>
                  <input
                    id="troco"
                    className="input"
                    type="text"
                    inputMode="decimal"
                    placeholder="R$ 50,00"
                    value={pedido.troco}
                    onChange={(e) => pedido.definir({ troco: e.target.value })}
                  />
                </div>
              </div>
            )}
          </section>

          <section className="block" aria-labelledby="t-obs">
            <div className="block-head">
              <h2 id="t-obs">Observações</h2>
            </div>
            <div className="grid6">
              <div className="f">
                <label htmlFor="obs">
                  Algo que a gente precisa saber? <small>(opcional)</small>
                </label>
                <textarea
                  id="obs"
                  className="input"
                  maxLength={500}
                  placeholder="É presente, interfone quebrado, prefere o início da janela…"
                  value={pedido.obs}
                  onChange={(e) => pedido.definir({ obs: e.target.value })}
                />
              </div>
            </div>
          </section>
        </form>
      </main>

      <div className="actionbar">
        <div className="in">
          <ListaErros visivel={tentou} mensagens={erros.pagamento.mensagens} />
          <TotalAcao total={resumo.total} aConfirmar={resumo.taxa.valor === null} />
          <button
            className="btn btn-primary btn-wide"
            type="button"
            onClick={() => {
              pedido.marcarTentativa("pagamento");
              if (!erros.pagamento.mensagens.length) router.push("/pedido/revisao");
            }}
          >
            Revisar pedido
          </button>
        </div>
      </div>
    </>
  );
}
