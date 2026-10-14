import { z } from "zod";
import { calcularFreteServidor } from "@/lib/frete-servidor";

const corpo = z.object({
  rua: z.string().trim().max(160).default(""),
  numero: z.string().trim().max(20).default(""),
  bairro: z.string().trim().max(120).default(""),
  cidade: z.string().trim().min(2).max(120),
  uf: z.string().trim().length(2).default("SP"),
});

const semCache = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let dados: z.infer<typeof corpo>;
  try {
    const parsed = corpo.safeParse(await request.json());
    if (!parsed.success || (!parsed.data.rua && !parsed.data.bairro)) {
      return Response.json({ erro: "endereco_invalido" }, { status: 400, headers: semCache });
    }
    dados = parsed.data;
  } catch {
    return Response.json({ erro: "json_invalido" }, { status: 400, headers: semCache });
  }

  try {
    return Response.json(await calcularFreteServidor(dados), { headers: semCache });
  } catch {
    // Sem log: a mensagem de erro poderia conter partes do endereço.
    return Response.json({ erro: "rota_indisponivel" }, { status: 502, headers: semCache });
  }
}
