"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { definirAbertaAgoraAcao, definirAutomaticoAcao, type ResultadoAcao } from "../../../app/admin/acoes";
import { Switch } from "@/components/admin/Switch";

type Props = {
  /** Modo automático (pelo horário)? */
  automatico: boolean;
  /** A loja está aberta agora (pelo horário ou à mão)? */
  aberta: boolean;
  /** "Aberto agora · fecha às 18h", "Fechado agora (à mão)"… */
  estado: string;
  /** Explicação curta do modo manual (vazia no automático). */
  explicacao: string;
  /** "Sábado e domingo, das 13h às 18h." */
  resumo: string;
};

type Mensagem = { ok: boolean; texto: string } | null;

/**
 * Cartão "Funcionamento" da Operação. Os switches salvam na hora; se falhar, voltam à posição anterior
 * (o valor otimista some quando a ação termina sem mudar a página) e aparece o aviso.
 */
export function Funcionamento({ automatico, aberta, estado, explicacao, resumo }: Props) {
  const [pendente, iniciar] = useTransition();
  const [auto, setAuto] = useOptimistic(automatico);
  const [abertaAgora, setAbertaAgora] = useOptimistic(aberta);
  const [mensagem, setMensagem] = useState<Mensagem>(null);

  function salvar(mudar: () => void, acao: () => Promise<ResultadoAcao>) {
    if (pendente) return;
    setMensagem(null);
    iniciar(async () => {
      mudar();
      let r: ResultadoAcao;
      try {
        r = await acao();
      } catch {
        r = { ok: false, erro: "Sem conexão com o servidor." };
      }
      setMensagem(
        r.ok
          ? { ok: true, texto: r.mensagem }
          : { ok: false, texto: `Não foi salvo: ${r.erro} A chave voltou à posição anterior.` },
      );
    });
  }

  return (
    <section className="adm-card adm-funcionamento" aria-labelledby="t-funcionamento" aria-busy={pendente}>
      <h2 id="t-funcionamento" className="adm-card-titulo">
        Funcionamento
      </h2>
      <p className={`adm-estado ${aberta ? "aberto" : ""}`}>
        <span aria-hidden="true">{aberta ? "●" : "○"}</span> {estado}
      </p>
      {explicacao && <p className="adm-apoio">{explicacao}</p>}
      <p className="adm-apoio">Horário: {resumo}</p>

      <Switch
        id="sw-automatico"
        rotulo="Abrir e fechar pelo horário"
        ligado={auto}
        descricao="ajuda-automatico"
        aoMudar={(v) =>
          salvar(
            () => setAuto(v),
            () => definirAutomaticoAcao(v),
          )
        }
      />
      <p id="ajuda-automatico" className="adm-apoio">
        {auto
          ? "A loja abre e fecha sozinha, conforme o horário da semana."
          : "Modo manual: você decide se a loja está aberta. À meia-noite, volta a seguir o horário."}
      </p>

      {!auto && (
        <Switch
          id="sw-aberta"
          rotulo="Loja aberta agora"
          ligado={abertaAgora}
          textoLigado="Aberta"
          textoDesligado="Fechada"
          aoMudar={(v) =>
            salvar(
              () => setAbertaAgora(v),
              () => definirAbertaAgoraAcao(v),
            )
          }
        />
      )}

      <p
        role="status"
        className={!pendente && mensagem ? `adm-msg ${mensagem.ok ? "ok" : "erro"}` : "adm-msg"}
      >
        {/* Enquanto salva, novos toques são ignorados; o texto diz por quê. */}
        {pendente && "Salvando…"}
        {!pendente && mensagem && (
          <>
            <span aria-hidden="true">{mensagem.ok ? "✓ " : "⚠ "}</span>
            {mensagem.texto}
          </>
        )}
      </p>

      <Link className="adm-link-grande" href="/admin/horario">
        Editar horário da semana
      </Link>
    </section>
  );
}
