"use client";

import { useRef, useState, useTransition } from "react";
import { salvarHorarioAcao, type ResultadoAcao } from "../../../app/admin/acoes";
import { Switch } from "@/components/admin/Switch";
import {
  HORAS_DO_DIA,
  NOMES_DIAS,
  ORDEM_SEMANA,
  hora,
  validarHorario,
  type ErroHorario,
  type HorarioSemana,
} from "@/lib/horario";

type Mensagem = { ok: boolean; texto: string } | null;

const igual = (a: HorarioSemana, b: HorarioSemana) => JSON.stringify(a) === JSON.stringify(b);
const idCampo = (dia: number, campo: "abre" | "fecha") => `h-${dia}-${campo}`;
const idErro = (dia: number) => `h-${dia}-erro`;

/**
 * Horário da semana (segunda a domingo). Salva só pelo botão: valida aqui e de novo no servidor.
 * Com erro, nada é salvo: o resumo no topo recebe o foco e cada dia mostra o erro junto ao campo.
 */
export function FormHorario({ inicial }: { inicial: HorarioSemana }) {
  const [salvo, setSalvo] = useState(inicial);
  const [horario, setHorario] = useState(inicial);
  const [erros, setErros] = useState<ErroHorario[]>([]);
  const [mensagem, setMensagem] = useState<Mensagem>(null);
  const [pendente, iniciar] = useTransition();
  const resumo = useRef<HTMLDivElement>(null);

  const alterado = !igual(horario, salvo);
  const nenhumAberto = horario.every((d) => !d.aberto);
  const errosDoDia = (dia: number) => erros.filter((e) => e.dia === dia);

  function mudar(dia: number, parte: Partial<HorarioSemana[number]>) {
    setHorario((h) => h.map((d, i) => (i === dia ? { ...d, ...parte } : d)));
    setMensagem(null);
    // O erro some do dia corrigido; os outros continuam até salvar de novo.
    setErros((e) => e.filter((x) => x.dia !== dia));
  }

  function mostrarErros(lista: ErroHorario[]) {
    setErros(lista);
    // Espera o resumo aparecer para mover o foco.
    requestAnimationFrame(() => resumo.current?.focus());
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (pendente) return;
    setMensagem(null);
    const v = validarHorario(horario);
    if (!v.ok) {
      mostrarErros(v.erros);
      return;
    }
    const enviado = v.horario;
    iniciar(async () => {
      let r: ResultadoAcao;
      try {
        r = await salvarHorarioAcao(enviado);
      } catch {
        r = { ok: false, erro: "Sem conexão com o servidor. Nada foi salvo." };
      }
      if (r.ok) {
        setErros([]);
        setSalvo(enviado);
        setHorario(enviado);
        setMensagem({ ok: true, texto: r.mensagem });
      } else if (r.erros?.length) {
        mostrarErros(r.erros);
      } else {
        setMensagem({ ok: false, texto: r.erro });
      }
    });
  }

  return (
    <form className="adm-horario" onSubmit={enviar} noValidate aria-busy={pendente}>
      {erros.length > 0 && (
        <div className="adm-resumo-erros" ref={resumo} tabIndex={-1} role="group" aria-labelledby="t-erros">
          <p id="t-erros">
            <span aria-hidden="true">⚠ </span>
            {erros.length === 1 ? "1 erro: nada foi salvo." : `${erros.length} erros: nada foi salvo.`}
          </p>
          <ul>
            {erros.map((e) => (
              <li key={`${e.dia}-${e.campo}`}>
                <a href={`#${idCampo(e.dia, e.campo)}`}>{e.mensagem}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ORDEM_SEMANA.map((dia) => {
        const d = horario[dia];
        const nome = NOMES_DIAS[dia];
        const lista = errosDoDia(dia);
        const invalido = (campo: "abre" | "fecha") => lista.some((e) => e.campo === campo) || undefined;
        return (
          <fieldset
            key={dia}
            className="adm-dia-horario"
            aria-describedby={lista.length ? idErro(dia) : undefined}
          >
            <legend>{nome}</legend>
            <Switch
              id={`h-${dia}-aberto`}
              rotulo={
                <>
                  <span className="sr-only">{nome}: </span>Abre neste dia
                </>
              }
              ligado={d.aberto}
              textoLigado="Aberto"
              textoDesligado="Fechado"
              aoMudar={(aberto) => mudar(dia, { aberto })}
            />
            {/* Dia fechado: as horas ficam escondidas, mas guardadas. */}
            {d.aberto && (
              <div className="adm-horas">
                {(["abre", "fecha"] as const).map((campo) => (
                  <div className="adm-campo" key={campo}>
                    <label htmlFor={idCampo(dia, campo)}>
                      <span className="sr-only">{nome}, </span>
                      {campo === "abre" ? "Abre às" : "Fecha às"}
                    </label>
                    <select
                      id={idCampo(dia, campo)}
                      value={d[campo]}
                      aria-invalid={invalido(campo)}
                      aria-describedby={invalido(campo) ? idErro(dia) : undefined}
                      onChange={(e) => mudar(dia, { [campo]: Number(e.target.value) })}
                    >
                      {/* Hora salva fora da lista (vinda de antes): aparece para não sumir. */}
                      {!HORAS_DO_DIA.includes(d[campo]) && <option value={d[campo]}>{hora(d[campo])}</option>}
                      {HORAS_DO_DIA.map((m) => (
                        <option key={m} value={m}>
                          {hora(m)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
            {lista.length > 0 && (
              <p className="adm-erro-campo" id={idErro(dia)}>
                <span aria-hidden="true">⚠ </span>
                {lista.map((e) => e.mensagem).join(" ")}
              </p>
            )}
          </fieldset>
        );
      })}

      {nenhumAberto && (
        <p className="adm-alerta-horario">
          <span aria-hidden="true">⚠ </span>
          <b>Nenhum dia aberto:</b> o site não terá horários para agendar.
        </p>
      )}

      <p role="status" className="adm-nao-salvo">
        {alterado && !pendente ? "Alterações não salvas" : ""}
      </p>
      <button type="submit" className="adm-salvar" aria-disabled={pendente || undefined}>
        {pendente ? "Salvando…" : "Salvar horário"}
      </button>
      <p role="status" className={mensagem ? `adm-msg ${mensagem.ok ? "ok" : "erro"}` : "adm-msg"}>
        {mensagem && (
          <>
            <span aria-hidden="true">{mensagem.ok ? "✓ " : "⚠ "}</span>
            {mensagem.texto}
          </>
        )}
      </p>
    </form>
  );
}
