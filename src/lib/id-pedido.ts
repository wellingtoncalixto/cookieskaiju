import { paredeSP } from "@/lib/tempo";

/**
 * ID do pedido: "CK-AAMMDD-XXXXXXX" (ex.: CK-261024-7K3QF9A).
 * - O prefixo "CK-" nunca colide com os pedidos históricos (IDs numéricos de 1 a 8).
 * - 7 caracteres aleatórios do alfabeto Crockford (sem I, L, O, U): 32^7 ≈ 34 bilhões por dia. Com 100
 *   pedidos num dia, a chance de dois coincidirem é de cerca de 1 em 7 milhões (paradoxo do aniversário).
 * - Gerado no navegador ao entrar na revisão, para já ir na mensagem do WhatsApp (que precisa abrir
 *   no mesmo toque do cliente). A unicidade de verdade é garantida pelo banco (chave primária).
 */
const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PADRAO = /^CK-\d{6}-[0-9A-HJKMNP-TV-Z]{7}$/;

export function gerarIdPedido(
  agora: number = Date.now(),
  aleatorio: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  const d = paredeSP(agora);
  const data = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const bytes = aleatorio(7);
  let sufixo = "";
  for (const b of bytes) sufixo += ALFABETO[b % 32];
  return `CK-${data}-${sufixo}`;
}

export const idPedidoValido = (id: unknown): id is string => typeof id === "string" && PADRAO.test(id);
