import { REGISTRO_PEDIDOS_ATIVO } from "@/config/registro";
import { idPedidoValido } from "@/lib/id-pedido";
import { bancoConfigurado } from "@/server/db";
import { reservarNumero } from "@/server/pedidos";

/**
 * Reserva o número do pedido (#57) quando o cliente chega na revisão, para ir na mensagem do WhatsApp.
 * Corpo: { chave: "CK-…", anterior?: "CK-…" }. Resposta: { numero }.
 */
const semCache = { "Cache-Control": "no-store" };

// No máximo 40 reservas a cada 10 minutos por IP (cada mudança na sacola pode pedir de novo).
const acessos = new Map<string, number[]>();
function excedeuLimite(ip: string, agora: number) {
  const recentes = (acessos.get(ip) ?? []).filter((t) => agora - t < 10 * 60_000);
  recentes.push(agora);
  acessos.set(ip, recentes);
  if (acessos.size > 5000) acessos.clear();
  return recentes.length > 40;
}

export async function POST(request: Request) {
  if (!REGISTRO_PEDIDOS_ATIVO || !bancoConfigurado())
    return Response.json({ erro: "desativado" }, { status: 503, headers: semCache });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  if (excedeuLimite(ip, Date.now()))
    return Response.json({ erro: "limite" }, { status: 429, headers: semCache });
  let corpo: { chave?: unknown; anterior?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "json_invalido" }, { status: 400, headers: semCache });
  }
  if (!idPedidoValido(corpo.chave))
    return Response.json({ erro: "chave_invalida" }, { status: 400, headers: semCache });
  const anterior = idPedidoValido(corpo.anterior) ? corpo.anterior : undefined;
  try {
    return Response.json({ numero: await reservarNumero(corpo.chave, anterior) }, { headers: semCache });
  } catch (erro) {
    console.error("pedidos: falha ao reservar número —", erro instanceof Error ? erro.message : erro);
    return Response.json({ erro: "falha_no_banco" }, { status: 502, headers: semCache });
  }
}
