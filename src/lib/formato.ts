/**
 * Formatações em pt-BR. O `Intl` de moeda usa espaço não separável depois de "R$",
 * o que atrapalha a mensagem do WhatsApp e os testes, então formatamos à mão.
 */
export function brl(valor: number): string {
  const [int, dec] = Math.abs(valor).toFixed(2).split(".");
  const milhar = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${valor < 0 ? "-" : ""}R$ ${milhar},${dec}`;
}

/** 4.2 -> "4,2" */
export const decimal1 = (n: number) => n.toFixed(1).replace(".", ",");

const ACENTOS = /\p{Diacritic}/gu;

/** Remove acentos, espaços extras e diferença de maiúsculas. */
export const normalizar = (s: string | undefined | null) =>
  (s ?? "").normalize("NFD").replace(ACENTOS, "").toLowerCase().replace(/\s+/g, " ").trim();

export const soDigitos = (s: string) => s.replace(/\D/g, "");

/** "100", "R$ 100" ou "R$100,00" -> "100" / "100,00" (o "R$" é recolocado na exibição). */
export const valorTroco = (s: string) => s.trim().replace(/^R\$\s*/i, "");

/** Máscara 00000-000 */
export function mascaraCep(valor: string): string {
  const d = soDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
