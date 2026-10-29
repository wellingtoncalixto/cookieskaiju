import { z } from "zod";
import { assinarCotacao } from "@/lib/assinatura";
import { soDigitos } from "@/lib/formato";
import { calcularFreteServidor } from "@/lib/frete-servidor";

const corpo = z.object({
  cep: z.string().trim().max(9).default(""),
  rua: z.string().trim().max(160).default(""),
  numero: z.string().trim().max(20).default(""),
  bairro: z.string().trim().max(120).default(""),
  cidade: z.string().trim().max(120).default(""),
  uf: z.string().trim().length(2).default("SP"),
  coordCep: z
    .object({ lat: z.number().finite(), lon: z.number().finite(), cidade: z.string().max(120).default("") })
    .nullish(),
});

const semCache = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let dados: z.infer<typeof corpo>;
  try {
    const parsed = corpo.safeParse(await request.json());
    const d = parsed.success ? parsed.data : null;
    // Precisa do CEP completo ou de cidade + rua/bairro.
    const temCep = d && soDigitos(d.cep).length === 8;
    const temEndereco = d && d.cidade && (d.rua || d.bairro);
    if (!d || (!temCep && !temEndereco)) {
      return Response.json({ erro: "endereco_invalido" }, { status: 400, headers: semCache });
    }
    dados = d;
  } catch {
    return Response.json({ erro: "json_invalido" }, { status: 400, headers: semCache });
  }

  try {
    const r = await calcularFreteServidor(dados);
    // Cotação assinada: /api/pedidos só aceita o frete com esta assinatura (o navegador não consegue forjar).
    const segredo = process.env.FRETE_COTACAO_SEGREDO;
    const cep = soDigitos(dados.cep);
    const cotacao =
      segredo && cep.length === 8
        ? assinarCotacao({ cep, km1Decimal: r.km1Decimal, kmCobrado: r.kmCobrado, valor: r.valor }, segredo)
        : undefined;
    return Response.json({ ...r, cotacao }, { headers: semCache });
  } catch (err) {
    // A mensagem diz só o passo e o serviço que falharam (ex.: "HTTP 403 (nominatim.openstreetmap.org)"),
    // nunca o endereço, então pode ir para o log e para a resposta.
    const etapa = err instanceof Error ? err.message : "erro desconhecido";
    console.error("frete: falhou —", etapa);
    return Response.json({ erro: "rota_indisponivel", etapa }, { status: 502, headers: semCache });
  }
}
