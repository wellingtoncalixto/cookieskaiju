import { lerEstadoLoja } from "@/server/modo-loja";

// Sempre lido na hora (nunca gerado no build).
export const dynamic = "force-dynamic";

/** Chave abrir/fechar do admin (e a hora de abrir, no "abre mais tarde"), lida pelo navegador. */
export async function GET() {
  return Response.json(
    await lerEstadoLoja(),
    // Cache curto na CDN: a mudança no admin chega ao site em até ~15 s.
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=30" } },
  );
}
