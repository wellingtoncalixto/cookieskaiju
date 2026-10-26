import { redirect } from "next/navigation";
import { entrar } from "../acoes";
import { Aviso } from "@/components/admin/Aviso";
import { adminConfigurado, sessaoValida } from "@/server/sessao-admin";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Login({ searchParams }: Props) {
  if (await sessaoValida()) redirect("/admin");
  return (
    <main className="adm-wrap">
      <div className="adm-login">
        <h1>Admin</h1>
        <p className="adm-mute">Cookies Kaiju · área restrita</p>
        <Aviso busca={searchParams} />
        {!adminConfigurado() && (
          <p className="adm-aviso erro">
            Defina ADMIN_SENHA e ADMIN_SEGREDO_SESSAO na Vercel para liberar o acesso.
          </p>
        )}
        <form action={entrar} className="adm-card" style={{ marginTop: 16 }}>
          <label className="adm-campo">
            <span>Senha</span>
            <input type="password" name="senha" autoComplete="current-password" required autoFocus />
          </label>
          <div className="adm-acoes">
            <button className="adm-btn primario" type="submit">
              Entrar
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
