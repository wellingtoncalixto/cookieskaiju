import { loja } from "@/config/loja";
import { brl, normalizar } from "@/lib/formato";

type ConfigFrete = { base: number; kmInclusos: number; porKm: number };
type ConfigPromo = { ate: string; cidades: readonly { nome: string; min: number }[] };

/**
 * Arredonda a distância como a regra oficial:
 * primeiro para 1 casa decimal (como o Google Maps mostra), depois sempre para cima.
 * 4,2 → 5 km · 3,0 → 3 km · 3,1 → 4 km.
 */
export function arredondarKm(distanciaKm: number) {
  const decimos = Math.round(distanciaKm * 10);
  return {
    km1Decimal: decimos / 10,
    kmCobrado: Math.max(1, Math.ceil(decimos / 10)),
  };
}

/** Até 3 km: R$ 3,00. Acima: R$ 3,00 + R$ 1,00 por km adicional. */
export function valorFrete(kmCobrado: number, cfg: ConfigFrete = loja.frete): number {
  return kmCobrado <= cfg.kmInclusos ? cfg.base : cfg.base + (kmCobrado - cfg.kmInclusos) * cfg.porKm;
}

export function calcularFrete(distanciaKm: number, cfg: ConfigFrete = loja.frete) {
  const { km1Decimal, kmCobrado } = arredondarKm(distanciaKm);
  return { km1Decimal, kmCobrado, valor: valorFrete(kmCobrado, cfg) };
}

export type Coord = { lat: number; lon: number };

/** Distância em linha reta (haversine), em km. Serve só para conferir se uma coordenada é plausível. */
export function distanciaRetaKm(a: Coord, b: Coord): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** A coordenada está dentro da área atendida (raio em linha reta a partir da loja)? */
export const dentroDaArea = (ponto: Coord, origem: Coord, raioKm: number = loja.frete.raioMaxKm) =>
  Number.isFinite(ponto.lat) && Number.isFinite(ponto.lon) && distanciaRetaKm(ponto, origem) <= raioKm;

const NUMERAIS =
  "um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte";
const RUA_GENERICA = new RegExp(
  `^(rua|avenida|av|travessa|alameda|viela|via|estrada|praca)\\.?\\s+(\\d+[a-z]?|[a-z]|${NUMERAIS})$`,
);

/** Nome de rua que se repete em vários bairros ("Rua 7", "Rua Dois", "Rua A"). */
export const ruaGenerica = (rua: string) => RUA_GENERICA.test(normalizar(rua));

/** A promoção ainda vale numa data (AAAA-MM-DD)? */
export const promoVigente = (dataIso: string, cfg: ConfigPromo = loja.promo) => dataIso <= cfg.ate;

export type ResultadoPromo = {
  cidade: string;
  min: number;
  gratis: boolean;
  falta: number;
};

/**
 * Promoção de lançamento: entrega grátis a partir de N cookies, por cidade,
 * comparando com a data de ENTREGA escolhida.
 * Retorna `null` quando a cidade não participa ou a data passou do limite.
 */
export function avaliarPromo(
  { cidade, quantidade, dataEntrega }: { cidade: string; quantidade: number; dataEntrega: string },
  cfg: ConfigPromo = loja.promo,
): ResultadoPromo | null {
  if (!promoVigente(dataEntrega, cfg)) return null;
  const alvo = normalizar(cidade);
  const c = cfg.cidades.find((x) => normalizar(x.nome) === alvo);
  if (!c) return null;
  return { cidade: c.nome, min: c.min, gratis: quantidade >= c.min, falta: Math.max(0, c.min - quantidade) };
}

/** Estado do cálculo da taxa (vem de /api/frete). */
export type EstadoFrete =
  | { status: "vazio" }
  | { status: "calculando" }
  | { status: "ok"; km1Decimal: number; kmCobrado: number; valor: number; aproximado: boolean }
  | { status: "falhou" };

/** Taxa já resolvida, considerando a promoção. Usada na tela e na mensagem. */
export type Taxa =
  | { tipo: "gratis"; valor: 0; cidade: string; min: number }
  | { tipo: "calculada"; valor: number; km1Decimal: number; kmCobrado: number; aproximado: boolean }
  | { tipo: "calculando"; valor: null }
  | { tipo: "confirmar"; valor: null }
  | { tipo: "pendente"; valor: null };

export function resolverTaxa(frete: EstadoFrete, promo: ResultadoPromo | null): Taxa {
  if (promo?.gratis) return { tipo: "gratis", valor: 0, cidade: promo.cidade, min: promo.min };
  switch (frete.status) {
    case "ok":
      return {
        tipo: "calculada",
        valor: frete.valor,
        km1Decimal: frete.km1Decimal,
        kmCobrado: frete.kmCobrado,
        aproximado: frete.aproximado,
      };
    case "calculando":
      return { tipo: "calculando", valor: null };
    case "falhou":
      return { tipo: "confirmar", valor: null };
    default:
      return { tipo: "pendente", valor: null };
  }
}

/** Aviso amarelo: "Adicione mais 1 cookie e a entrega em Mogi Mirim fica grátis." */
export function dicaPromo(promo: ResultadoPromo | null, quantidade: number): string {
  if (!promo || promo.gratis || quantidade === 0) return "";
  return `Adicione mais ${promo.falta} cookie${promo.falta > 1 ? "s" : ""} e a entrega em ${promo.cidade} fica grátis.`;
}

/** Textos da taxa para a interface. */
export function textosTaxa(taxa: Taxa) {
  switch (taxa.tipo) {
    case "gratis":
      return {
        curto: "Grátis",
        detalhe: `Promoção de lançamento: ${taxa.min}+ cookies em ${taxa.cidade} não pagam entrega.`,
      };
    case "calculada":
      return {
        curto: brl(taxa.valor),
        // Os km não aparecem para o cliente; vão só na mensagem do WhatsApp, para a loja conferir.
        detalhe: taxa.aproximado ? "Estimada pelo bairro. A loja confirma no WhatsApp." : "",
      };
    case "calculando":
      return { curto: "calculando", detalhe: "Traçando a rota até o seu endereço." };
    case "confirmar":
      return {
        curto: "a confirmar",
        detalhe: `Não deu para calcular a rota automaticamente. A loja confirma a taxa no WhatsApp (a partir de ${brl(loja.frete.base)}).`,
      };
    default:
      return { curto: "na próxima etapa", detalhe: "Preencha o endereço para calcular." };
  }
}
