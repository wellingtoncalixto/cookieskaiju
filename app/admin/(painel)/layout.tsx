import { sair } from "../acoes";
import { NavAdmin } from "@/components/admin/NavAdmin";
import { bancoConfigurado } from "@/server/db";
import { exigirAdmin } from "@/server/sessao-admin";

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  await exigirAdmin();
  return (
    <>
      <header className="adm-topo">
        <div className="adm-wrap">
          <span className="adm-marca">Kaiju Admin</span>
          <NavAdmin sair={sair} />
        </div>
      </header>
      <main className="adm-wrap">
        {!bancoConfigurado() && (
          <p className="adm-aviso erro">
            Banco de dados não configurado: conecte o Neon ao projeto na Vercel (DATABASE_URL).
          </p>
        )}
        {children}
      </main>
    </>
  );
}
