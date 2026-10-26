import { revalidateTag } from "next/cache";
import { REGISTRO_PEDIDOS_ATIVO } from "@/config/registro";
import { lerCotacao } from "@/lib/assinatura";
import { TAG_CATALOGO } from "@/server/catalogo";
import { bancoConfigurado } from "@/server/db";
import { esquemaEntrada, registrarPedido } from "@/server/pedidos";

/**
 * Registra o pedido no banco (painel admin). Nunca recebe nome, telefone nem endereço.
 * Fica desligado até NEXT_PUBLIC_REGISTRO_PEDIDOS=true.
 *
 * Respostas: { ok: true, duplicado } ou { ok: false, erro, definitivo }.
 * `definitivo: true` = não adianta repetir (o navegador descarta da fila).
 */
const semCache = { "Cache-Control": "no-store" };
const responder = (status: number, corpo: object) => Response.json(corpo, { status, headers: semCache });

// Limite simples por IP: 30 envios a cada 10 minutos (folga para operadoras que põem muitos clientes
// no mesmo IP e para as novas tentativas). É aproximado (cada instância da Vercel tem o seu).
const JANELA_MS = 10 * 60_000;
const MAX_POR_JANELA = 30;
const acessos = new Map<string, number[]>();
function excedeuLimite(ip: string, agora: number) {
  const recentes = (acessos.get(ip) ?? []).filter((t) => agora - t < JANELA_MS);
  recentes.push(agora);
  acessos.set(ip, recentes);
  if (acessos.size > 5000) acessos.clear();
  return recentes.length > MAX_POR_JANELA;
}

export async function POST(request: Request) {
  if (!REGISTRO_PEDIDOS_ATIVO || !bancoConfigurado())
    return responder(503, { ok: false, erro: "desativado", definitivo: true });

  const agora = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  if (excedeuLimite(ip, agora)) return responder(429, { ok: false, erro: "limite", definitivo: false });

  const bruto = await request.text();
  if (bruto.length > 4000) return responder(413, { ok: false, erro: "grande_demais", definitivo: true });
  let json: unknown;
  try {
    json = JSON.parse(bruto);
  } catch {
    return responder(400, { ok: false, erro: "json_invalido", definitivo: true });
  }
  const entrada = esquemaEntrada.safeParse(json);
  if (!entrada.success) return responder(400, { ok: false, erro: "dados_invalidos", definitivo: true });

  const segredoFrete = process.env.FRETE_COTACAO_SEGREDO;
  try {
    const r = await registrarPedido(entrada.data, agora, (token) =>
      segredoFrete ? lerCotacao(token, segredoFrete, agora) : null,
    );
    if (!r.ok) return responder(400, { ok: false, erro: r.erro, definitivo: true });
    // O estoque mudou: o cardápio (esgotado) precisa refletir na próxima visita.
    if (!r.duplicado) revalidateTag(TAG_CATALOGO, { expire: 0 });
    return responder(200, { ok: true, id: entrada.data.id, duplicado: r.duplicado });
  } catch (erro) {
    // Log sem dados pessoais (o pedido não tem nenhum): só o ID e a mensagem técnica.
    console.error("pedidos: falha ao registrar", {
      id: entrada.data.id,
      erro: erro instanceof Error ? erro.message : String(erro),
    });
    return responder(502, { ok: false, erro: "falha_no_banco", definitivo: false });
  }
}
