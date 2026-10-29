import { z } from "zod";
import { horarioValido, type Agenda } from "@/lib/agenda";

/** Resultado de validação: mensagens na ordem dos campos e ids dos campos inválidos. */
export type Erros = { mensagens: string[]; campos: string[] };

const obrigatorio = (msg: string) => z.string().trim().min(1, { error: msg });

export const esquemaEndereco = z.object({
  rua: obrigatorio("Informe a rua."),
  numero: obrigatorio("Informe o número."),
  bairro: obrigatorio("Informe o bairro."),
  cidade: obrigatorio("Informe a cidade."),
});

export const esquemaDados = z.object({
  nome: obrigatorio("Informe seu nome."),
  pagamento: z.enum(["pix", "credito", "debito", "dinheiro"], { error: "Escolha a forma de pagamento." }),
});

function deZod(r: { success: boolean; error?: z.ZodError }, ordem: string[]): Erros {
  if (r.success || !r.error) return { mensagens: [], campos: [] };
  const issues = [...r.error.issues].sort(
    (a, b) => ordem.indexOf(String(a.path[0])) - ordem.indexOf(String(b.path[0])),
  );
  return { mensagens: issues.map((i) => i.message), campos: issues.map((i) => String(i.path[0])) };
}

const juntar = (...lista: Erros[]): Erros => ({
  mensagens: lista.flatMap((e) => e.mensagens),
  campos: lista.flatMap((e) => e.campos),
});

export type Contexto = {
  quantidade: number;
  agenda: Agenda;
};

type DadosEntrega = {
  /** Na retirada não há endereço a validar. Ausente = entrega. */
  modalidade?: "entrega" | "retirada";
  horario: string | null;
  endereco: { rua: string; numero: string; bairro: string; cidade: string };
};
type DadosPagamento = { nome: string; pagamento: string | null };

export function errosSacola({ quantidade }: Contexto): Erros {
  // A loja fechada não impede o pedido: o cliente agenda um horário.
  return { mensagens: quantidade ? [] : ["Sua sacola está vazia."], campos: [] };
}

export function errosEntrega(ctx: Contexto, dados: DadosEntrega): Erros {
  const retirada = dados.modalidade === "retirada";
  const horario: Erros = horarioValido(ctx.agenda, dados.horario)
    ? { mensagens: [], campos: [] }
    : {
        mensagens: [`Escolha quando quer ${retirada ? "retirar" : "receber"} o pedido.`],
        campos: ["horario"],
      };
  const endereco: Erros = retirada
    ? { mensagens: [], campos: [] }
    : deZod(esquemaEndereco.safeParse(dados.endereco), ["rua", "numero", "bairro", "cidade"]);
  return juntar(errosSacola(ctx), horario, endereco);
}

export function errosPagamento(dados: DadosPagamento): Erros {
  return deZod(esquemaDados.safeParse(dados), ["nome", "pagamento"]);
}

export type Etapa = "entrega" | "pagamento" | "revisao";

/** Primeira etapa pendente antes de `alvo` (ou `null` se pode seguir). Sacola vazia volta para "/". */
export function etapaPendente(
  alvo: Etapa,
  ctx: Contexto,
  dados: DadosEntrega & DadosPagamento,
): "inicio" | Etapa | null {
  if (!ctx.quantidade) return "inicio";
  if (alvo === "entrega") return null;
  if (errosEntrega(ctx, dados).mensagens.length) return "entrega";
  if (alvo === "pagamento") return null;
  if (errosPagamento(dados).mensagens.length) return "pagamento";
  return null;
}
