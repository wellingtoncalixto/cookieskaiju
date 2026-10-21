import { REGISTRO_PEDIDOS_ATIVO } from "@/config/planilha";
import { enviarAoAppsScript } from "@/lib/apps-script";
import { lerCotacao } from "@/lib/assinatura";
import { esquemaEntrada, montarRegistro } from "@/lib/registro-pedido";

/**
 * Registra o pedido no Painel Comercial (Google Sheets) via Apps Script.
 * Nunca recebe nome, telefone nem endereço. Fica desligado até NEXT_PUBLIC_REGISTRO_PEDIDOS=true.
 *
 * Respostas: { ok: true, id, duplicado } ou { ok: false, erro, definitivo }.
 * `definitivo: true` = não adianta repetir (o navegador descarta da fila).
 */
const semCache = { "Cache-Control": "no-store" };
const responder = (status: number, corpo: object) => Response.json(corpo, { status, headers: semCache });

// Limite simples por IP: 30 envios a cada 10 minutos (folga para operadoras que põem muitos clientes
// no mesmo IP e para as novas tentativas). É aproximado (cada instância da Vercel tem o seu), mas barra
// abuso casual; as cotas do Apps Script são a última barreira.
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
  if (!REGISTRO_PEDIDOS_ATIVO) return responder(503, { ok: false, erro: "desativado", definitivo: true });

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
  const montado = montarRegistro(entrada.data, agora, (token) =>
    segredoFrete ? lerCotacao(token, segredoFrete, agora) : null,
  );
  if (!montado.ok) return responder(400, { ok: false, erro: montado.erro, definitivo: true });

  const r = await enviarAoAppsScript(montado.corpo);
  if (!r.ok) {
    // Log sem dados pessoais (o pedido já não tem nenhum): só o ID e o código do erro.
    console.error("pedidos: falha ao registrar", { id: montado.corpo.id, erro: r.erro });
    return responder(r.definitivo ? 400 : 502, { ok: false, erro: r.erro, definitivo: r.definitivo });
  }
  for (const aviso of r.avisos) console.warn("pedidos: aviso da planilha", { id: montado.corpo.id, aviso });
  return responder(200, { ok: true, id: montado.corpo.id, duplicado: r.duplicado });
}
