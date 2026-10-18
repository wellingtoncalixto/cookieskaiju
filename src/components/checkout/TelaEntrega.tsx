"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AvisoPrivacidade } from "@/components/Basicos";
import { CabecalhoEtapa, Carregando, ListaErros, TotalAcao } from "@/components/checkout/Comum";
import { loja } from "@/config/loja";
import { useCheckout, useGuardaEtapa } from "@/hooks/useCheckout";
import { CHAVE_AGORA, chaveHorario, horarioValido, textoPrevisao } from "@/lib/agenda";
import { mascaraCep, normalizar, soDigitos } from "@/lib/formato";
import { textosTaxa, type EstadoFrete } from "@/lib/frete";
import type { Endereco } from "@/lib/mensagem";
import { DIAS, DIAS_CURTOS, capitalizar, dataDeIso, ddmm } from "@/lib/tempo";
import { usePedido } from "@/store/pedido";
import mascoteSono from "../../../public/brand/mascote-sonolento.png";

export function TelaEntrega() {
  const router = useRouter();
  const c = useCheckout();
  const liberada = useGuardaEtapa("entrega", c);
  const { pedido, situacao, resumo, erros } = c;
  const { endereco, definirEndereco, definir } = pedido;
  const tentou = pedido.tentou.entrega;
  const retirada = loja.retirada.habilitada && pedido.modalidade === "retirada";
  const invalido = (campo: string) => (tentou && erros.entrega.campos.includes(campo)) || undefined;

  // Se o horário escolhido deixou de valer, limpa. Se dá para pedir para hoje, já deixa essa opção marcada.
  useEffect(() => {
    if (!situacao) return;
    const ag = situacao.agenda;
    if (!horarioValido(ag, usePedido.getState().horario))
      usePedido.getState().definir({ horario: ag.agora ? CHAVE_AGORA : null });
  }, [situacao]);

  useFrete(endereco, !retirada);
  const cep = useCep();
  const [diaEscolhido, setDia] = useState<string | null>(null);
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
  // Dia mostrado no seletor: o que o cliente tocou, senão o do horário já escolhido, senão o primeiro.
  const diaDoHorario = pedido.horario?.split("|")[0];
  const diaAtivo =
    ag.dias.find((d) => d.data === diaEscolhido) ??
    ag.dias.find((d) => d.data === diaDoHorario) ??
    ag.dias[0];
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
          {loja.retirada.habilitada && (
            <section className="block" aria-labelledby="t-como">
              <div className="block-head">
                <h2 id="t-como">Como receber</h2>
              </div>
              <fieldset className="pay">
                <legend className="sr-only">Entrega ou retirada</legend>
                {(
                  [
                    ["entrega", "Entrega", "No seu endereço, em Mogi Mirim ou Mogi Guaçu"],
                    ["retirada", "Retirada", "Sem taxa de entrega"],
                  ] as const
                ).map(([id, nome, desc]) => (
                  <label className="chip" key={id}>
                    <input
                      type="radio"
                      name="modalidade"
                      value={id}
                      checked={pedido.modalidade === id}
                      onChange={() => definir({ modalidade: id })}
                    />
                    <span>
                      {nome}
                      <em>{desc}</em>
                    </span>
                  </label>
                ))}
              </fieldset>
            </section>
          )}

          <section className="block" aria-labelledby="t-quando">
            <div className="block-head">
              <h2 id="t-quando">{retirada ? "Quando retirar" : "Quando entregar"}</h2>
            </div>
            <div className="slots">
              {ag.modo === "fechada" && (
                <div className="closed">
                  <Image src={mascoteSono} alt="" width={72} />
                  <p>
                    <b>Estamos fechados agora.</b> {situacao.textos.texto}
                  </p>
                </div>
              )}
              {ag.agora && (
                <div className="chips hoje" data-invalido={invalido("horario")}>
                  <label className="chip">
                    <input
                      type="radio"
                      name="horario"
                      value={CHAVE_AGORA}
                      checked={pedido.horario === CHAVE_AGORA}
                      onChange={() => definir({ horario: CHAVE_AGORA })}
                    />
                    <span>
                      {retirada ? "Hoje, pronto em" : "Hoje, em"} {loja.agenda.prazoMinimoMin} a{" "}
                      {loja.agenda.prazoMaximoMin} min
                      <em>previsão {textoPrevisao(ag)}</em>
                    </span>
                  </label>
                </div>
              )}
              {ag.agora && <p className="fmsg">Ou agende para outro dia:</p>}
              {/* Seletor de dias: as faixas aparecem só para o dia escolhido. */}
              <fieldset className="slot-day">
                <legend className="sr-only">Dia</legend>
                <div className="dias" role="radiogroup" aria-label="Dia">
                  {ag.dias.map((d) => {
                    const data = dataDeIso(d.data);
                    return (
                      <label className="chip" key={d.data}>
                        <input
                          type="radio"
                          name="dia"
                          value={d.data}
                          checked={d.data === diaAtivo?.data}
                          onChange={() => setDia(d.data)}
                        />
                        <span>
                          {DIAS_CURTOS[data.getUTCDay()]}
                          <em>{ddmm(data)}</em>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {diaAtivo && (
                <fieldset className="slot-day">
                  <legend className="sr-only">
                    Horário em {capitalizar(DIAS[dataDeIso(diaAtivo.data).getUTCDay()])},{" "}
                    {ddmm(dataDeIso(diaAtivo.data))}
                  </legend>
                  <div className="chips" data-invalido={invalido("horario")}>
                    {loja.janelas.map((j) => {
                      const chave = chaveHorario(diaAtivo.data, j.id);
                      return (
                        <label className="chip" key={chave}>
                          <input
                            type="radio"
                            name="horario"
                            value={chave}
                            checked={pedido.horario === chave}
                            disabled={!diaAtivo.janelas.some((x) => x.id === j.id)}
                            onChange={() => definir({ horario: chave })}
                          />
                          <span>{j.nome}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </div>
          </section>

          {retirada ? (
            <section className="block" aria-labelledby="t-retirada">
              <div className="block-head">
                <h2 id="t-retirada">Local de retirada</h2>
              </div>
              <p className="hint">{loja.retirada.aviso}</p>
            </section>
          ) : (
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
          )}
        </form>
      </main>

      <div className="actionbar">
        <div className="in">
          <ListaErros visivel={tentou} mensagens={erros.entrega.mensagens} />
          <TotalAcao total={resumo.total} aConfirmar={resumo.taxa.valor === null} />
          <button
            className="btn btn-primary btn-wide"
            type="button"
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
function useFrete(e: Endereco, ativo: boolean) {
  const seq = useRef(0);
  useEffect(() => {
    // Na retirada não há taxa: não calcula (e mantém o último cálculo, se o cliente voltar para entrega).
    if (!ativo) return;
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
        // O CEP é localizado daqui do navegador: cada cliente usa a própria cota do serviço de CEP
        // (do servidor, o IP compartilhado da hospedagem esbarra no limite de requisições).
        const coordCep = temCep ? await localizarCep(cep, ctl.signal) : null;
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
            coordCep,
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
  }, [ativo, e.cep, e.rua, e.numero, e.bairro, e.cidade, e.uf]);
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

/** CEP → coordenadas (AwesomeAPI), consultado pelo navegador. Retorna `null` se não houver coordenada. */
async function localizarCep(cep: string, signal: AbortSignal) {
  try {
    const r = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`, { signal });
    if (!r.ok) return null;
    const j = (await r.json()) as { lat?: string; lng?: string; city?: string };
    const lat = Number(j.lat);
    const lon = Number(j.lng);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, cidade: j.city ?? "" } : null;
  } catch {
    return null;
  }
}
