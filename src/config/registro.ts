/**
 * Registro dos pedidos do site no banco (painel admin). Sem isso, o checkout funciona exatamente como antes:
 * o pedido segue só pelo WhatsApp, sem código.
 */
export const REGISTRO_PEDIDOS_ATIVO = process.env.NEXT_PUBLIC_REGISTRO_PEDIDOS === "true";
