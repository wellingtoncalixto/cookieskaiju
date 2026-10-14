import { z } from "zod";
import { soDigitos } from "@/lib/formato";
import { calcularFreteServidor } from "@/lib/frete-servidor";

const corpo = z.object({
  cep: z.string().trim().max(9).default(""),
  rua: z.string().trim().max(160).default(""),
  numero: z.string().trim().max(20).default(""),
  bairro: z.string().trim().max(120).default(""),
  cidade: z.string().trim().max(120).default(""),
  uf: z.string().trim().length(2).default("SP"),
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
    return Response.json(await calcularFreteServidor(dados), { headers: semCache });
  } catch {
    // Sem log: a mensagem de erro poderia conter partes do endereço.
    return Response.json({ erro: "rota_indisponivel" }, { status: 502, headers: semCache });
  }
}
