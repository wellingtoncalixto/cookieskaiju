import { estoqueAtual } from "@/server/estoque";

// Sempre lido na hora: a revisão do pedido confere o estoque antes de liberar o envio.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await estoqueAtual(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json([], { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
