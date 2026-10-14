import type { Metadata } from "next";
import { TelaSacola } from "@/components/checkout/TelaSacola";

export const metadata: Metadata = {
  title: "Sacola",
  robots: { index: false, follow: false },
};

export default function PaginaSacola() {
  return <TelaSacola />;
}
