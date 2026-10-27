import { bancoConfigurado } from "@/server/db";
import { pedidosNovos, ultimoNumeroSite } from "@/server/pedidos";
import { sessaoValida } from "@/server/sessao-admin";

// Fica sob /admin para receber o cookie da sessão (que vale só para /admin).
export const dynamic = "force-dynamic";

/**
 * Alerta de pedidos novos do admin. Sem `desde`: devolve o último número (ponto de partida).
 * Com `desde`: devolve os pedidos que chegaram depois dele.
 */
export async function GET(request: Request) {
  const semCache = { "Cache-Control": "no-store" };
  if (!(await sessaoValida())) return Response.json({ erro: "sessao" }, { status: 401, headers: semCache });
  if (!bancoConfigurado()) return Response.json({ ultimo: 0, pedidos: [] }, { headers: semCache });
  const param = new URL(request.url).searchParams.get("desde");
  const desde = param ? Number(param) : NaN;
  if (!Number.isInteger(desde) || desde < 0)
    return Response.json({ ultimo: await ultimoNumeroSite(), pedidos: [] }, { headers: semCache });
  const pedidos = await pedidosNovos(desde);
  return Response.json({ ultimo: pedidos.at(-1)?.numero ?? desde, pedidos }, { headers: semCache });
}
