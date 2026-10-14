"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AvisoPrivacidade } from "@/components/Basicos";
import { CabecalhoEtapa, Carregando, ListaErros, TotalAcao } from "@/components/checkout/Comum";
import { loja } from "@/config/loja";
import { useCheckout, useGuardaEtapa } from "@/hooks/useCheckout";
import { chaveHorario, horarioValido } from "@/lib/agenda";
import { mascaraCep, normalizar, soDigitos } from "@/lib/formato";
import { textosTaxa, type EstadoFrete } from "@/lib/frete";
import type { Endereco } from "@/lib/mensagem";
import { DIAS, capitalizar, dataDeIso, ddmm } from "@/lib/tempo";
import { usePedido } from "@/store/pedido";
import mascoteSono from "../../../public/brand/mascote-sonolento.png";

export function TelaEntrega() {
  const router = useRouter();
  const c = useCheckout();
  const liberada = useGuardaEtapa("entrega", c);
  const { pedido, situacao, resumo, erros } = c;
  const { endereco, definirEndereco, definir } = pedido;
  const tentou = pedido.tentou.entrega;
  const invalido = (campo: string) => (tentou && erros.entrega.campos.includes(campo)) || undefined;

  // Se a agenda mudou e o horário escolhido sumiu, limpa; se só há uma opção, escolhe.
  useEffect(() => {
    if (!situacao) return;
    const ag = situacao.agenda;
    const validos = ag.dias.flatMap((d) => d.janelas.map((j) => chaveHorario(d.data, j.id)));
    if (!horarioValido(ag, usePedido.getState().horario))
      usePedido.getState().definir({ horario: validos.length === 1 ? validos[0] : null });
  }, [situacao]);

  useFrete(endereco);
  const cep = useCep();
  const cabecalho = (
    <CabecalhoEtapa titulo="Entrega" subtitulo="Etapa 1 de 3" etapa={1} voltarPara="/sacola" />
  );

  if (!liberada || !situacao) {
    return (
      <>
        {cabecalho}
        <Carregando />
      </>
    );
  }

  const ag = situacao.agenda;
  const taxa = textosTaxa(resumo.taxa);
  const gratis = resumo.taxa.tipo === "gratis";

  const campo = (
    id: keyof Endereco,
    rotulo: React.ReactNode,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <>
      <label htmlFor={id}>{rotulo}</label>
      <input
        id={id}
        className="input"
        type="text"
        value={endereco[id]}
        aria-invalid={invalido(id)}
        onChange={(e) => definirEndereco({ [id]: e.target.value })}
        {...props}
      />
    </>
  );

  return (
    <>
      {cabecalho}
      <main id="conteudo">
        <form className="col screen" noValidate autoComplete="off" onSubmit={(e) => e.preventDefault()}>
          <section className="block" aria-labelledby="t-quando">
            <div className="block-head">
              <h2 id="t-quando">Quando entregar</h2>
            </div>
            {ag.modo === "fechada" ? (
              <div className="closed">
                <Image src={mascoteSono} alt="" width={72} />
                <p>
                  <b>Agenda fechada.</b> {situacao.textos.texto} Sua sacola fica guardada neste aparelho até
                  lá.
                </p>
              </div>
            ) : (
              <div className="slots">
                {ag.modo === "estoque" && (
                  <p className="fmsg">
                    Pronta-entrega: o pedido depende do estoque do dia e é confirmado pela loja no WhatsApp.
                  </p>
                )}
                {ag.dias.map((d) => {
                  const data = dataDeIso(d.data);
                  return (
                    <fieldset className="slot-day" key={d.data}>
                      <legend>
                        {capitalizar(DIAS[data.getUTCDay()])} <span>{ddmm(data)}</span>
                      </legend>
                      <div className="chips" data-invalido={invalido("horario")}>
                        {loja.janelas.map((j) => {
                          const chave = chaveHorario(d.data, j.id);
                          return (
                            <label className="chip" key={chave}>
                              <input
                                type="radio"
                                name="horario"
                                value={chave}
                                checked={pedido.horario === chave}
                                disabled={!d.janelas.some((x) => x.id === j.id)}
                                onChange={() => definir({ horario: chave })}
                              />
                              <span>{j.nome}</span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            )}
          </section>

          <section className="block" aria-labelledby="t-endereco">
            <div className="block-head">
              <h2 id="t-endereco">Endereço</h2>
            </div>
            <div className="grid6">
              <div className="f s3 keep">
                <label htmlFor="cep">CEP</label>
                <input
                  id="cep"
                  className="input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="13800-000"
                  maxLength={9}
                  value={endereco.cep}
                  aria-describedby="cep-msg"
                  onChange={(e) => cep.alterar(e.target.value)}
                />
              </div>
              <div className="f s3 keep cep-msg">
                <span id="cep-msg" className={`fmsg ${cep.classe}`} aria-live="polite">
                  {cep.buscando && <span className="spin" aria-hidden="true" />}
                  {cep.msg}
                </span>
              </div>
              <div className="f s4">{campo("rua", "Rua", { autoComplete: "address-line1" })}</div>
              <div className="f s2">{campo("numero", "Número", { inputMode: "numeric" })}</div>
              <div className="f s3">
                {campo(
                  "complemento",
                  <>
                    Complemento <small>(opcional)</small>
                  </>,
                  { placeholder: "Apto, bloco, casa" },
                )}
              </div>
              <div className="f s3">{campo("bairro", "Bairro")}</div>
              <div className="f s4">
                {campo("cidade", "Cidade", { autoComplete: "address-level2", placeholder: "Mogi Mirim" })}
              </div>
              <div className="f s2">
                {campo("uf", "UF", { maxLength: 2, autoComplete: "address-level1" })}
              </div>
              <div className="f">
                {campo(
                  "referencia",
                  <>
                    Ponto de referência <small>(opcional)</small>
                  </>,
                  { placeholder: "Portão preto, ao lado da padaria" },
                )}
              </div>
            </div>

            <div className={`fee${gratis ? " free" : ""}`} aria-live="polite">
              <span className="t">
                <b>Taxa de entrega</b>
                {taxa.detalhe}
                {!gratis && resumo.dica && (
                  <>
                    <br />
                    <span className="hl">{resumo.dica}</span>
                  </>
                )}
              </span>
              <span className="v">
                {resumo.taxa.tipo === "calculando" && <span className="spin" aria-hidden="true" />}
                {resumo.taxa.tipo === "pendente" ? "—" : taxa.curto}
              </span>
            </div>
            <AvisoPrivacidade variante="endereco" />
          </section>
        </form>
      </main>

      <div className="actionbar">
        <div className="in">
          <ListaErros visivel={tentou} mensagens={erros.entrega.mensagens} />
          <TotalAcao total={resumo.total} aConfirmar={resumo.taxa.valor === null} />
          <button
            className="btn btn-primary btn-wide"
            type="button"
            aria-disabled={ag.modo === "fechada" || undefined}
            onClick={() => {
              pedido.marcarTentativa("entrega");
              if (!erros.entrega.mensagens.length) router.push("/pedido/pagamento");
            }}
          >
            Continuar para pagamento
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Calcula a taxa no servidor (debounce de 900 ms). A busca é pelo CEP assim que ele estiver completo;
 * sem CEP, usa rua, número, bairro e cidade.
 */
function useFrete(e: Endereco) {
  const seq = useRef(0);
  useEffect(() => {
    const { definir } = usePedido.getState();
    const cep = soDigitos(e.cep);
    const temCep = cep.length === 8;
    const completo = temCep || (e.rua.trim() && e.numero.trim() && e.bairro.trim() && e.cidade.trim());
    // Com CEP, o número não muda a localização: digitar o número não refaz o cálculo.
    const chave = temCep
      ? `cep:${cep}`
      : [e.rua, e.numero, e.bairro, e.cidade, e.uf].map(normalizar).join("|");
    if (!completo) {
      if (usePedido.getState().frete.status !== "vazio")
        definir({ frete: { status: "vazio" }, freteChave: "" });
      return;
    }
    const atual = usePedido.getState();
    if (chave === atual.freteChave && atual.frete.status !== "vazio") return;

    const meu = ++seq.current;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      definir({ frete: { status: "calculando" }, freteChave: chave });
      let frete: EstadoFrete;
      try {
        const r = await fetch("/api/frete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cep: e.cep,
            rua: e.rua,
            numero: e.numero,
            bairro: e.bairro,
            cidade: e.cidade,
            uf: e.uf || "SP",
          }),
          signal: ctl.signal,
        });
        if (!r.ok) throw new Error();
        const j = (await r.json()) as {
          km1Decimal: number;
          kmCobrado: number;
          valor: number;
          aproximado: boolean;
        };
        frete = { status: "ok", ...j };
      } catch {
        if (ctl.signal.aborted) return;
        frete = { status: "falhou" };
      }
      if (meu === seq.current) definir({ frete });
    }, 900);
    return () => {
      clearTimeout(t);
      ctl.abort();
      // Se a busca foi interrompida no meio, libera para recalcular.
      if (usePedido.getState().frete.status === "calculando")
        usePedido.getState().definir({ freteChave: "" });
    };
  }, [e.cep, e.rua, e.numero, e.bairro, e.cidade, e.uf]);
}

/** Máscara do CEP e preenchimento automático pelo ViaCEP (direto do navegador). */
function useCep() {
  const [estado, setEstado] = useState({
    msg: "Preenche o endereço automaticamente.",
    classe: "",
    buscando: false,
  });
  const ultimo = useRef("");

  async function alterar(valor: string) {
    const { definirEndereco, endereco } = usePedido.getState();
    const cep = mascaraCep(valor);
    definirEndereco({ cep });
    const d = soDigitos(cep);
    if (d.length < 8) {
      ultimo.current = "";
      setEstado({ msg: "Preenche o endereço automaticamente.", classe: "", buscando: false });
      return;
    }
    if (d === ultimo.current) return;
    ultimo.current = d;
    setEstado({ msg: "Buscando endereço…", classe: "", buscando: true });
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, {
        headers: { Accept: "application/json" },
      });
      if (!r.ok) throw new Error("rede");
      const j = (await r.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (j.erro) throw new Error("cep");
      if (ultimo.current !== d) return;
      definirEndereco({
        ...(j.logradouro ? { rua: j.logradouro } : {}),
        ...(j.bairro ? { bairro: j.bairro } : {}),
        ...(j.localidade ? { cidade: j.localidade } : {}),
        ...(j.uf ? { uf: j.uf } : {}),
      });
      setEstado({
        msg: `${j.localidade}/${j.uf}. Confira e informe o número.`,
        classe: "ok",
        buscando: false,
      });
      if (!endereco.numero) document.getElementById("numero")?.focus();
    } catch (err) {
      setEstado({
        msg:
          (err as Error).message === "cep"
            ? "CEP não encontrado. Preencha o endereço abaixo."
            : "Não deu para buscar o CEP. Preencha o endereço abaixo.",
        classe: "err",
        buscando: false,
      });
    }
  }

  return { ...estado, alterar };
}
