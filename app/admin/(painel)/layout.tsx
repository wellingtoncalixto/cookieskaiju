import { sair } from "../acoes";
import { AlertaPedidos } from "@/components/admin/AlertaPedidos";
import { NavAdmin } from "@/components/admin/NavAdmin";
import { hostDoBanco, problemaNoBanco } from "@/server/db";
import { exigirAdmin } from "@/server/sessao-admin";

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  await exigirAdmin();
  const problema = await problemaNoBanco();
  return (
    <>
      <header className="adm-topo">
        <div className="adm-wrap">
          <span className="adm-marca">Kaiju Admin</span>
          <AlertaPedidos />
          <NavAdmin sair={sair} />
        </div>
      </header>
      <main className="adm-wrap">
        {/* Com o banco fora do ar ou sem tabelas, mostra o motivo em vez de quebrar a página. */}
        {problema ? <p className="adm-aviso erro">{problema}</p> : children}
        <p className="adm-mute" style={{ marginTop: 32 }}>
          Banco: {hostDoBanco()}
        </p>
      </main>
    </>
  );
}
