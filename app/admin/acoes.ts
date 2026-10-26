"use server";

import { put } from "@vercel/blob";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { modoValido, gravarModoLoja } from "@/server/modo-loja";
import { TAG_CATALOGO } from "@/server/catalogo";
import {
  adicionarIngrediente,
  alterarIngrediente,
  excluirInsumo,
  excluirReceita,
  obterProduto,
  removerIngrediente,
  salvarConfiguracao,
  salvarInsumo,
  salvarProduto,
  salvarReceita,
} from "@/server/cadastros";
import { STATUS, mudarStatus } from "@/server/pedidos";
import {
  adminConfigurado,
  criarSessao,
  encerrarSessao,
  exigirAdmin,
  loginBloqueado,
  registrarErroLogin,
  senhaConfere,
} from "@/server/sessao-admin";

/** Volta para a página com um aviso (?ok= ou ?erro=). */
function voltar(caminho: string, aviso: { ok?: string; erro?: string }): never {
  const q = new URLSearchParams(aviso as Record<string, string>).toString();
  redirect(q ? `${caminho}?${q}` : caminho);
}

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
/** Aceita "1,5" e "1.5". Vazio → null. */
function numero(f: FormData, k: string): number | null {
  const s = texto(f, k).replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
const id = (f: FormData, k = "id") => {
  const n = Number(texto(f, k));
  return Number.isInteger(n) && n > 0 ? n : null;
};

// ---------------------------------------------------------------- sessão

export async function entrar(form: FormData) {
  if (!adminConfigurado())
    voltar("/admin/login", { erro: "Admin não configurado (ADMIN_SENHA e ADMIN_SEGREDO_SESSAO)." });
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  if (loginBloqueado(ip)) voltar("/admin/login", { erro: "Muitas tentativas. Espere 15 minutos." });
  if (!senhaConfere(texto(form, "senha"))) {
    registrarErroLogin(ip);
    voltar("/admin/login", { erro: "Senha incorreta." });
  }
  await criarSessao();
  redirect("/admin");
}

export async function sair() {
  await encerrarSessao();
  redirect("/admin/login");
}

// ---------------------------------------------------------------- operação

export async function definirModoLoja(form: FormData) {
  await exigirAdmin();
  const modo = texto(form, "modo");
  if (!modoValido(modo)) voltar("/admin", { erro: "Opção inválida." });
  const r = await gravarModoLoja(modo);
  if (!r.ok) voltar("/admin", { erro: r.erro });
  const msg = {
    automatico: "Loja seguindo o horário automático.",
    aberto: "Delivery aberto.",
    fechado: "Delivery fechado.",
  };
  voltar("/admin", { ok: `${msg[modo]} O site atualiza em até 1 minuto.` });
}

export async function definirStatusPedido(form: FormData) {
  await exigirAdmin();
  const pedido = texto(form, "pedido");
  const status = texto(form, "status");
  if (!(STATUS as readonly string[]).includes(status)) voltar("/admin", { erro: "Status inválido." });
  if (!(await mudarStatus(pedido, status as (typeof STATUS)[number])))
    voltar("/admin", { erro: "Pedido não encontrado." });
  voltar("/admin", {});
}

// ---------------------------------------------------------------- produtos

const esquemaProduto = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "Endereço (slug): só letras minúsculas, números e hífen." }),
  nome: z.string().min(1, { error: "Informe o nome." }).max(60),
  destaque: z.string().max(80),
  descricao: z.string().max(400),
  alt: z.string().max(200),
  preco: z.number({ error: "Preço inválido." }).min(0).max(1000),
  ordem: z.number().int(),
});

async function enviarImagem(arquivo: FormDataEntryValue | null, nome: string): Promise<string | null> {
  if (!(arquivo instanceof File) || arquivo.size === 0) return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Envio de fotos não configurado (Vercel Blob).");
  if (!arquivo.type.startsWith("image/")) throw new Error("O arquivo precisa ser uma imagem.");
  if (arquivo.size > 3_500_000) throw new Error("Imagem grande demais (máximo 3,5 MB).");
  const ext = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
  const blob = await put(`produtos/${nome}.${ext}`, arquivo, {
    access: "public",
    addRandomSuffix: true,
    contentType: arquivo.type,
  });
  return blob.url;
}

export async function salvarProdutoAcao(form: FormData) {
  await exigirAdmin();
  const pid = id(form);
  const caminho = pid ? `/admin/produtos/${pid}` : "/admin/produtos/novo";
  const dados = esquemaProduto.safeParse({
    slug: texto(form, "slug"),
    nome: texto(form, "nome"),
    destaque: texto(form, "destaque"),
    descricao: texto(form, "descricao"),
    alt: texto(form, "alt"),
    preco: numero(form, "preco"),
    ordem: numero(form, "ordem") ?? 0,
  });
  if (!dados.success) voltar(caminho, { erro: dados.error.issues[0].message });
  const atual = pid ? await obterProduto(pid) : undefined;
  let foto = atual?.foto ?? null;
  let cartaz = atual?.cartaz ?? null;
  try {
    foto = (await enviarImagem(form.get("foto"), dados.data.slug)) ?? foto;
    cartaz = (await enviarImagem(form.get("cartaz"), `${dados.data.slug}-cartaz`)) ?? cartaz;
  } catch (e) {
    voltar(caminho, { erro: e instanceof Error ? e.message : "Falha ao enviar a imagem." });
  }
  // Sabor novo precisa de foto (as do repositório só existem para os sabores antigos).
  if (!pid && !foto) voltar(caminho, { erro: "Envie a foto do sabor." });
  let salvo: number;
  try {
    salvo = await salvarProduto(pid, {
      ...dados.data,
      alt: dados.data.alt || `Cookie ${dados.data.nome}`,
      disponivel: form.get("disponivel") === "on",
      ativo: form.get("ativo") === "on",
      foto,
      cartaz,
      receitaId: id(form, "receitaId"),
    });
  } catch (e) {
    const duplicado = e instanceof Error && /unique|duplicate/i.test(e.message);
    voltar(caminho, {
      erro: duplicado ? "Já existe um produto com esse endereço (slug)." : "Não foi possível salvar.",
    });
  }
  revalidateTag(TAG_CATALOGO, { expire: 0 });
  voltar(`/admin/produtos/${salvo}`, { ok: "Produto salvo. O site já mostra a mudança." });
}

// ---------------------------------------------------------------- precificação

const P = "/admin/precificacao";

export async function salvarInsumoAcao(form: FormData) {
  await exigirAdmin();
  const nome = texto(form, "nome");
  const unidade = texto(form, "unidade");
  const qtd = numero(form, "embalagemQtd");
  const preco = numero(form, "embalagemPreco");
  if (!nome) voltar(P, { erro: "Informe o nome do insumo." });
  if (!["g", "ml", "un"].includes(unidade)) voltar(P, { erro: "Unidade inválida." });
  if (qtd == null || !(qtd > 0)) voltar(P, { erro: "Tamanho da embalagem inválido." });
  if (preco == null || !(preco >= 0)) voltar(P, { erro: "Preço da embalagem inválido." });
  try {
    await salvarInsumo(id(form), { nome, unidade: unidade as "g", embalagemQtd: qtd, embalagemPreco: preco });
  } catch {
    voltar(P, { erro: "Não foi possível salvar (nome repetido?)." });
  }
  voltar(P, { ok: `Insumo "${nome}" salvo. Custos recalculados.` });
}

export async function excluirInsumoAcao(form: FormData) {
  await exigirAdmin();
  const i = id(form);
  if (!i || !(await excluirInsumo(i)))
    voltar(P, { erro: "Esse insumo está em uma receita: tire-o da receita antes." });
  voltar(P, { ok: "Insumo excluído." });
}

export async function salvarReceitaAcao(form: FormData) {
  await exigirAdmin();
  const nome = texto(form, "nome");
  const tipo = texto(form, "tipo");
  const rendimento = numero(form, "rendimento");
  const unidade = texto(form, "unidadeRendimento");
  const mo = numero(form, "maoDeObraPct");
  if (!nome) voltar(P, { erro: "Informe o nome da receita." });
  if (!["sabor", "base"].includes(tipo)) voltar(P, { erro: "Tipo inválido." });
  if (rendimento == null || !(rendimento > 0)) voltar(P, { erro: "Rendimento inválido." });
  if (!["un", "g"].includes(unidade)) voltar(P, { erro: "Unidade do rendimento inválida." });
  if (mo != null && !(mo >= 0 && mo <= 500)) voltar(P, { erro: "Mão de obra inválida." });
  let rid: number;
  try {
    rid = await salvarReceita(id(form), {
      nome,
      tipo: tipo as "sabor",
      rendimento,
      unidadeRendimento: unidade as "un",
      maoDeObraPct: (mo ?? 0) / 100,
      usaForno: form.get("usaForno") === "on",
    });
  } catch {
    voltar(P, { erro: "Não foi possível salvar (nome repetido?)." });
  }
  voltar(`${P}#receita-${rid}`, { ok: `Receita "${nome}" salva. Custos recalculados.` });
}

export async function excluirReceitaAcao(form: FormData) {
  await exigirAdmin();
  const i = id(form);
  if (!i || !(await excluirReceita(i)))
    voltar(P, { erro: "Essa receita está ligada a um produto ou entra em outra receita." });
  voltar(P, { ok: "Receita excluída." });
}

export async function adicionarIngredienteAcao(form: FormData) {
  await exigirAdmin();
  const receita = id(form, "receitaId");
  const [tipo, ref] = texto(form, "item").split(":");
  const quantidade = numero(form, "quantidade");
  const alvo = Number(ref);
  if (!receita || !["i", "r"].includes(tipo) || !(alvo > 0)) voltar(P, { erro: "Escolha o ingrediente." });
  if (quantidade == null || !(quantidade > 0)) voltar(P, { erro: "Quantidade inválida." });
  if (tipo === "r" && alvo === receita) voltar(P, { erro: "Uma receita não pode usar a si mesma." });
  await adicionarIngrediente(receita, {
    insumoId: tipo === "i" ? alvo : null,
    subReceitaId: tipo === "r" ? alvo : null,
    quantidade,
  });
  voltar(`${P}#receita-${receita}`, { ok: "Ingrediente adicionado." });
}

export async function alterarIngredienteAcao(form: FormData) {
  await exigirAdmin();
  const i = id(form);
  const quantidade = numero(form, "quantidade");
  if (!i || quantidade == null || !(quantidade > 0)) voltar(P, { erro: "Quantidade inválida." });
  await alterarIngrediente(i, quantidade);
  voltar(`${P}#receita-${texto(form, "receitaId")}`, { ok: "Quantidade atualizada." });
}

export async function removerIngredienteAcao(form: FormData) {
  await exigirAdmin();
  const i = id(form);
  if (i) await removerIngrediente(i);
  voltar(`${P}#receita-${texto(form, "receitaId")}`, { ok: "Ingrediente removido." });
}

export async function salvarFornoAcao(form: FormData) {
  await exigirAdmin();
  const chaves = ["forno_potencia_w", "forno_minutos_fornada", "forno_cookies_fornada", "energia_kwh"];
  const valores: Record<string, number | null> = {};
  for (const k of chaves) {
    const v = numero(form, k);
    if (v != null && !(v >= 0)) voltar(P, { erro: "Valor inválido nos parâmetros do forno." });
    valores[k] = v;
  }
  await salvarConfiguracao(valores);
  voltar(P, { ok: "Parâmetros do forno salvos. Custos recalculados." });
}
