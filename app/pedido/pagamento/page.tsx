import type { Metadata } from "next";
import { TelaPagamento } from "@/components/checkout/TelaPagamento";

export const metadata: Metadata = {
  title: "Dados e pagamento",
  robots: { index: false, follow: false },
};

export default function Pagina() {
  return <TelaPagamento />;
}
