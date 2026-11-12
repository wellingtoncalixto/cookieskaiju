/**
 * Filtro de /api/pedidos e /api/pedidos/numero: só aceita JSON enviado pelas páginas do próprio site.
 * Impede que a página de outro site dispare envios pelo navegador dos visitantes (um formulário ou fetch de fora
 * chega com outra origem ou como text/plain). Os route handlers do Next não conferem a origem sozinhos (só as
 * Server Actions conferem), então a conferência fica aqui, comparando Origin com Host / X-Forwarded-Host como elas.
 * Sem Origin e sem Sec-Fetch-Site (ferramentas, não navegador), passa: o objetivo não é bloquear scripts.
 */
export function recusaEnvio(request: Request): { status: 403 | 415; erro: string } | null {
  const h = request.headers;
  const site = h.get("sec-fetch-site");
  if (site && site !== "same-origin") return { status: 403, erro: "origem_recusada" };
  const origem = h.get("origin");
  if (origem) {
    const host = (h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || "").toLowerCase();
    let hostOrigem = "";
    try {
      hostOrigem = new URL(origem).host; // "null" (iframe isolado, arquivo local) não é endereço: recusa
    } catch {}
    if (!host || hostOrigem !== host) return { status: 403, erro: "origem_recusada" };
  }
  const tipo = h.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (tipo !== "application/json") return { status: 415, erro: "tipo_invalido" };
  return null;
}
