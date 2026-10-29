/** Aviso vindo de uma ação do admin (?ok= ou ?erro=). */
export async function Aviso({ busca }: { busca: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await busca;
  const ok = typeof q.ok === "string" ? q.ok : null;
  const erro = typeof q.erro === "string" ? q.erro : null;
  if (!ok && !erro) return null;
  return (
    <p className={`adm-aviso ${erro ? "erro" : "ok"}`} role={erro ? "alert" : "status"}>
      {erro ?? ok}
    </p>
  );
}
