import { create } from "zustand";
import type { FormaPagamento } from "@/config/loja";
import type { EstadoFrete } from "@/lib/frete";
import type { Endereco } from "@/lib/mensagem";

/**
 * Dados do checkout. Ficam SÓ em memória (sem persist): nome, telefone, endereço e
 * observações somem ao recarregar a página ou ao fazer um novo pedido (LGPD).
 */
export type EstadoPedido = {
  horario: string | null;
  endereco: Endereco;
  frete: EstadoFrete;
  /** Endereço (normalizado) do último cálculo de frete. */
  freteChave: string;
  nome: string;
  telefone: string;
  pagamento: FormaPagamento["id"] | null;
  troco: string;
  obs: string;
  /** Etapas em que o cliente já tocou em "Continuar" (para mostrar erros ao vivo). */
  tentou: { entrega: boolean; pagamento: boolean; revisao: boolean };
  /** Mensagem enviada (tela de confirmação). */
  mensagemEnviada: string | null;
};

type Acoes = {
  definir: (parcial: Partial<EstadoPedido>) => void;
  definirEndereco: (parcial: Partial<Endereco>) => void;
  marcarTentativa: (etapa: keyof EstadoPedido["tentou"]) => void;
  limpar: () => void;
};

const inicial = (): EstadoPedido => ({
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
  telefone: "",
  pagamento: null,
  troco: "",
  obs: "",
  tentou: { entrega: false, pagamento: false, revisao: false },
  mensagemEnviada: null,
});

export const usePedido = create<EstadoPedido & Acoes>()((set) => ({
  ...inicial(),
  definir: (parcial) => set(parcial),
  definirEndereco: (parcial) => set((s) => ({ endereco: { ...s.endereco, ...parcial } })),
  marcarTentativa: (etapa) => set((s) => ({ tentou: { ...s.tentou, [etapa]: true } })),
  limpar: () => set(inicial()),
}));
