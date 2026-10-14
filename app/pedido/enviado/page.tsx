import type { Metadata } from "next";
import { TelaEnviado } from "@/components/checkout/TelaEnviado";

export const metadata: Metadata = {
  title: "Pedido enviado",
  robots: { index: false, follow: false },
};

export default function Pagina() {
  return <TelaEnviado />;
}
