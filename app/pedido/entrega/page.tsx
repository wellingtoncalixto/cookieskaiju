import type { Metadata } from "next";
import { TelaEntrega } from "@/components/checkout/TelaEntrega";

export const metadata: Metadata = {
  title: "Entrega",
  robots: { index: false, follow: false },
};

export default function Pagina() {
  return <TelaEntrega />;
}
