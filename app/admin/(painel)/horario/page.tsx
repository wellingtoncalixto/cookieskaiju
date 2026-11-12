import Link from "next/link";
import { FormHorario } from "@/components/admin/FormHorario";
import { lerHorario } from "@/server/horario";
import { exigirAdmin } from "@/server/sessao-admin";

/** Horário de funcionamento da semana (um horário por dia). */
export default async function Horario() {
  await exigirAdmin();
  const horario = await lerHorario();
  return (
    <>
      <p style={{ marginTop: 16 }}>
        <Link href="/admin">← Operação</Link>
      </p>
      <h1>Horário</h1>
      <p className="adm-apoio" style={{ maxWidth: 640 }}>
        Os dias e as horas em que a loja abre. O site usa este horário para abrir e fechar sozinho (no modo
        automático), para o pedido para hoje e para as faixas de 1 hora de agendamento de cada dia.
      </p>
      <FormHorario inicial={horario} />
    </>
  );
}
