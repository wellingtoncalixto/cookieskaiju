import { create } from "zustand";
import type { FormaPagamento } from "@/config/loja";
import type { EstadoFrete } from "@/lib/frete";
import type { Endereco } from "@/lib/mensagem";

/**
 * Dados do checkout. Ficam SÓ em memória (sem persist): nome, endereço e
 * observações somem ao recarregar a página ou ao fazer um novo pedido (LGPD).
 */
export type Modalidade = "entrega" | "retirada";

export type EstadoPedido = {
  modalidade: Modalidade;
  horario: string | null;
  endereco: Endereco;
  frete: EstadoFrete;
  /** Endereço (normalizado) do último cálculo de frete. */
  freteChave: string;
  nome: string;
  pagamento: FormaPagamento["id"] | null;
  troco: string;
  obs: string;
  /** Etapas em que o cliente já tocou em "Continuar" (para mostrar erros ao vivo). */
  tentou: { entrega: boolean; pagamento: boolean; revisao: boolean };
  /** Mensagem enviada (tela de confirmação). */
  mensagemEnviada: string | null;
  /** ID do pedido (vai na mensagem e no painel). Muda se o conteúdo do pedido mudar. */
  idPedido: string | null;
  /** Conteúdo do pedido quando o ID foi gerado (ver assinaturaConteudo). */
  idConteudo: string | null;
  /** Número do pedido mostrado ao cliente (#57), reservado na revisão. */
  numeroPedido: number | null;
  /** Registro no painel da loja: só "registrado" depois da confirmação do servidor. */
  registro: "inativo" | "enviando" | "registrado" | "falhou";
};

type Acoes = {
  definir: (parcial: Partial<EstadoPedido>) => void;
  definirEndereco: (parcial: Partial<Endereco>) => void;
  marcarTentativa: (etapa: keyof EstadoPedido["tentou"]) => void;
  limpar: () => void;
};

const inicial = (): EstadoPedido => ({
  modalidade: "entrega",
  horario: null,
  endereco: {
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "SP",
    referencia: "",
  },
  frete: { status: "vazio" },
  freteChave: "",
  nome: "",
  pagamento: null,
  troco: "",
  obs: "",
  tentou: { entrega: false, pagamento: false, revisao: false },
  mensagemEnviada: null,
  idPedido: null,
  idConteudo: null,
  numeroPedido: null,
  registro: "inativo",
});

export const usePedido = create<EstadoPedido & Acoes>()((set) => ({
  ...inicial(),
  definir: (parcial) => set(parcial),
  definirEndereco: (parcial) => set((s) => ({ endereco: { ...s.endereco, ...parcial } })),
  marcarTentativa: (etapa) => set((s) => ({ tentou: { ...s.tentou, [etapa]: true } })),
  limpar: () => set(inicial()),
}));
