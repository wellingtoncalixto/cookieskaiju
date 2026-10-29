import "server-only";
import { obterBanco } from "@/server/db";
import type { ConfigCustos } from "@/lib/valores-pedido";
import type { ParametrosForno } from "@/lib/precificacao";

export type ItemConfiguracao = { chave: string; valor: number | null; unidade: string; nota: string };

export async function lerConfiguracao(): Promise<ItemConfiguracao[]> {
  return obterBanco().consulta<ItemConfiguracao>(
    "select chave, valor::float8 as valor, unidade, nota from configuracao order by chave",
  );
}

export async function mapaConfiguracao(): Promise<Record<string, number | null>> {
  return Object.fromEntries((await lerConfiguracao()).map((c) => [c.chave, c.valor]));
}

const CHAVES_CUSTOS: (keyof ConfigCustos)[] = [
  "kraft_preco",
  "kraft_cookies_por_saco",
  "flyer_aquecimento",
  "flyer_marca",
  "moto_km_por_litro",
  "gasolina_litro",
  "taxa_pix",
  "taxa_debito",
  "taxa_credito",
  "taxa_dinheiro",
];

export function configCustos(m: Record<string, number | null>): ConfigCustos {
  return Object.fromEntries(CHAVES_CUSTOS.map((k) => [k, m[k] ?? null])) as ConfigCustos;
}

export function parametrosForno(m: Record<string, number | null>): ParametrosForno {
  return {
    potenciaW: m.forno_potencia_w ?? null,
    minutosFornada: m.forno_minutos_fornada ?? null,
    cookiesFornada: m.forno_cookies_fornada ?? null,
    precoKwh: m.energia_kwh ?? null,
  };
}
