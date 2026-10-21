/**
 * Registro do pedido no Painel Comercial, do lado do navegador.
 *
 * - Nunca atrasa o WhatsApp: o envio começa no toque em "Enviar pedido" e segue em segundo plano.
 * - O resumo NÃO tem nome, telefone, endereço nem a mensagem: só ID, sabores, quantidades,
 *   modalidade, horário escolhido, pagamento, cidade, CEP (para conferir a cotação de frete) e a cotação.
 * - Fila de contingência (localStorage "ck_registros"): no máximo 3 resumos, por no máximo 24h,
 *   apagados assim que confirmados (ou recusados de vez). Não há identificador de cliente.
 */

export type EntradaCliente = {
  id: string;
  modalidade: "entrega" | "retirada";
  horario: string;
  itens: { slug: string; quantidade: number }[];
  pagamento: "pix" | "credito" | "debito" | "dinheiro";
  cidade: string;
  cep: string;
  cotacao?: string;
};

export type ResultadoEnvio = { ok: true; duplicado: boolean } | { ok: false; definitivo: boolean };

type ItemFila = { entrada: EntradaCliente; criadoEm: number };

const CHAVE_FILA = "ck_registros";
export const FILA_MAX = 3;
export const FILA_VALIDADE_MS = 24 * 3600_000;
const ESPERAS_MS = [2_000, 6_000, 20_000];

/** Conteúdo que define o pedido: se mudar, o pedido ganha um ID novo. */
export const assinaturaConteudo = (e: Omit<EntradaCliente, "id" | "cotacao">) =>
  JSON.stringify([e.modalidade, e.horario, e.itens, e.pagamento, e.cidade.trim().toLowerCase(), e.cep]);

// ---------- fila (funções puras + acesso ao localStorage) ----------

export function filaAtualizada(fila: ItemFila[], agora: number): ItemFila[] {
  return fila.filter((i) => agora - i.criadoEm < FILA_VALIDADE_MS).slice(-FILA_MAX);
}

export function filaComItem(fila: ItemFila[], entrada: EntradaCliente, agora: number): ItemFila[] {
  const sem = fila.filter((i) => i.entrada.id !== entrada.id);
  return filaAtualizada([...sem, { entrada, criadoEm: agora }], agora);
}

export const filaSemItem = (fila: ItemFila[], id: string) => fila.filter((i) => i.entrada.id !== id);

function lerFila(): ItemFila[] {
  try {
    const bruto = localStorage.getItem(CHAVE_FILA);
    const fila = bruto ? (JSON.parse(bruto) as ItemFila[]) : [];
    return Array.isArray(fila) ? fila : [];
  } catch {
    return [];
  }
}

function gravarFila(fila: ItemFila[]) {
  try {
    if (fila.length) localStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
    else localStorage.removeItem(CHAVE_FILA);
  } catch {}
}

// ---------- envio ----------

export async function enviarRegistro(entrada: EntradaCliente): Promise<ResultadoEnvio> {
  try {
    const r = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entrada),
      keepalive: true, // continua mesmo se a aba trocar para o WhatsApp
    });
    const j = (await r.json().catch(() => ({}))) as {
      ok?: boolean;
      duplicado?: boolean;
      definitivo?: boolean;
    };
    if (r.ok && j.ok) return { ok: true, duplicado: !!j.duplicado };
    return { ok: false, definitivo: j.definitivo === true };
  } catch {
    return { ok: false, definitivo: false };
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Registra com novas tentativas (mesmo ID: a planilha nunca duplica).
 * Guarda na fila antes de enviar e tira dela quando confirma ou quando o servidor recusa de vez.
 */
export async function registrarComTentativas(
  entrada: EntradaCliente,
  aoMudar: (estado: "enviando" | "registrado" | "falhou") => void,
): Promise<void> {
  gravarFila(filaComItem(lerFila(), entrada, Date.now()));
  aoMudar("enviando");
  for (let tentativa = 0; tentativa <= ESPERAS_MS.length; tentativa++) {
    if (tentativa > 0) await esperar(ESPERAS_MS[tentativa - 1]);
    const r = await enviarRegistro(entrada);
    if (r.ok) {
      gravarFila(filaSemItem(lerFila(), entrada.id));
      aoMudar("registrado");
      return;
    }
    if (r.definitivo) {
      gravarFila(filaSemItem(lerFila(), entrada.id));
      break;
    }
  }
  // Falhas temporárias: o resumo fica na fila e é reenviado na próxima visita (até 24h).
  aoMudar("falhou");
}

/** Na abertura do site: reenvia o que ficou na fila (uma tentativa cada) e descarta o vencido. */
export async function processarFila(): Promise<void> {
  const fila = filaAtualizada(lerFila(), Date.now());
  gravarFila(fila);
  for (const { entrada } of fila) {
    const r = await enviarRegistro(entrada);
    if (r.ok || r.definitivo) gravarFila(filaSemItem(lerFila(), entrada.id));
  }
}
