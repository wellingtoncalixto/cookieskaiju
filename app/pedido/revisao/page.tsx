import type { Metadata } from "next";
import { TelaRevisao } from "@/components/checkout/TelaRevisao";

export const metadata: Metadata = {
  title: "Revisar pedido",
  robots: { index: false, follow: false },
};

export default function Pagina() {
  return <TelaRevisao />;
}
