import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hmacHex } from "@/lib/assinatura";

/**
 * Sessão do admin: uma senha só (ADMIN_SENHA) e um cookie assinado com ADMIN_SEGREDO_SESSAO,
 * válido por 12 horas. Sem as duas variáveis, o admin fica fechado.
 */
const COOKIE = "ck_admin";
const DURACAO_MS = 12 * 3600_000;

const iguais = (a: string, b: string) => {
  // Compara os hashes (mesmo tamanho), para não vazar o tamanho da senha pelo tempo de resposta.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
};

export const adminConfigurado = () => Boolean(process.env.ADMIN_SENHA && process.env.ADMIN_SEGREDO_SESSAO);

export function senhaConfere(senha: string) {
  const certa = process.env.ADMIN_SENHA;
  return Boolean(certa) && iguais(senha, certa!);
}

function tokenValido(token: string | undefined, agora = Date.now()) {
  const segredo = process.env.ADMIN_SEGREDO_SESSAO;
  if (!token || !segredo) return false;
  const [exp, assinatura] = token.split(".");
  if (!exp || !assinatura || !iguais(assinatura, hmacHex(`admin.${exp}`, segredo))) return false;
  return Number(exp) > agora;
}

export async function criarSessao() {
  const exp = String(Date.now() + DURACAO_MS);
  const token = `${exp}.${hmacHex(`admin.${exp}`, process.env.ADMIN_SEGREDO_SESSAO!)}`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: DURACAO_MS / 1000,
  });
}

export async function encerrarSessao() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}

export async function sessaoValida() {
  return tokenValido((await cookies()).get(COOKIE)?.value);
}

/** Para páginas e ações do admin: sem sessão válida, volta para o login. */
export async function exigirAdmin() {
  if (!(await sessaoValida())) redirect("/admin/login");
}

// Tentativas de login: no máximo 5 erros a cada 15 minutos por IP (aproximado: por instância).
const erros = new Map<string, number[]>();
export function loginBloqueado(ip: string, agora = Date.now()) {
  const recentes = (erros.get(ip) ?? []).filter((t) => agora - t < 15 * 60_000);
  erros.set(ip, recentes);
  return recentes.length >= 5;
}
export function registrarErroLogin(ip: string, agora = Date.now()) {
  erros.set(ip, [...(erros.get(ip) ?? []), agora]);
  if (erros.size > 5000) erros.clear();
}
