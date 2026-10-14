import "server-only";
import { loja } from "@/config/loja";
import { mascaraCep, normalizar, soDigitos } from "@/lib/formato";
import { calcularFrete, dentroDaArea, ruaGenerica, type Coord } from "@/lib/frete";

/**
 * Cálculo da distância de rota no servidor.
 *
 * Localização do cliente, nesta ordem:
 *   1. Pelo CEP (AwesomeAPI de CEP → coordenadas). É o mais preciso para Mogi Mirim, onde muitas ruas
 *      têm nomes genéricos ("Rua 6", "Rua Dois") que a busca por nome confunde entre bairros.
 *   2. Sem CEP, ou com CEP sem coordenada válida: Nominatim (OpenStreetMap) por rua com número, rua sem
 *      número e só o bairro (este último marcado como aproximado), restrito à região da loja.
 * Toda coordenada fora do raio de atendimento é descartada como erro de busca.
 * Rota: OSRM. Com GOOGLE_MAPS_API_KEY definida, o Google faz as duas coisas (localiza o endereço com CEP e
 * calcula a rota), que é a opção mais precisa e a mesma fonte que a loja usa para conferir.
 *
 * Privacidade: os endereços recebidos NÃO são gravados nem registrados em log.
 * O cache em memória guarda só o resultado numérico, indexado por um hash do CEP/endereço.
 */

export type EnderecoFrete = {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
};
export type ResultadoFrete = { km1Decimal: number; kmCobrado: number; valor: number; aproximado: boolean };

const TIMEOUT_MS = 9000;
const CACHE_TTL_MS = 6 * 3600_000;
const CACHE_MAX = 500;
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT || "CookiesKaiju/1.0 (contato: WhatsApp +55 19 98426-8415)";

// ---------- cache (por hash do CEP ou do endereço normalizado) ----------
const cache = new Map<string, { expira: number; valor: ResultadoFrete }>();

async function chaveCache(e: EnderecoFrete) {
  const cep = soDigitos(e.cep);
  // Com CEP, o número não muda a localização: digitar o número não refaz a busca.
  const texto =
    cep.length === 8 ? `cep:${cep}` : [e.rua, e.numero, e.bairro, e.cidade, e.uf].map(normalizar).join("|");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Buffer.from(hash).toString("base64url");
}

function lerCache(chave: string) {
  const item = cache.get(chave);
  if (!item) return null;
  if (item.expira < Date.now()) {
    cache.delete(chave);
    return null;
  }
  return item.valor;
}

function gravarCache(chave: string, valor: ResultadoFrete) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(chave, { expira: Date.now() + CACHE_TTL_MS, valor });
}

// ---------- utilidades ----------
async function buscarJSON<T>(url: string, init: RequestInit = {}): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

function coordsDoAmbiente(): Coord | null {
  const lat = Number(process.env.LOJA_LAT);
  const lon = Number(process.env.LOJA_LON);
  return process.env.LOJA_LAT && process.env.LOJA_LON && Number.isFinite(lat) && Number.isFinite(lon)
    ? { lat, lon }
    : null;
}

// ---------- 1. CEP → coordenadas ----------
async function coordPorCep(cep: string, cidade: string, origem: Coord): Promise<Coord | null> {
  const d = soDigitos(cep);
  if (d.length !== 8) return null;
  try {
    const j = await buscarJSON<{ lat?: string; lng?: string; city?: string }>(
      `https://cep.awesomeapi.com.br/json/${d}`,
    );
    const c = { lat: Number(j.lat), lon: Number(j.lng) };
    // Descarta se a cidade não bate ou se a coordenada cai fora da área (erros da base de CEPs).
    if (cidade && j.city && normalizar(j.city) !== normalizar(cidade)) return null;
    return dentroDaArea(c, origem) ? c : null;
  } catch {
    return null;
  }
}

// ---------- 2. Nominatim (plano B) ----------
// Fila global: no máximo 1 requisição por segundo ao Nominatim (política de uso).
let filaNominatim: Promise<unknown> = Promise.resolve();
let ultimaNominatim = 0;
function naFila<T>(fn: () => Promise<T>): Promise<T> {
  const p = filaNominatim.then(async () => {
    const espera = ultimaNominatim + 1100 - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultimaNominatim = Date.now();
    return fn();
  });
  filaNominatim = p.catch(() => undefined);
  return p;
}

async function nominatim(params: Record<string, string>, origem: Coord): Promise<Coord | null> {
  // Restringe a busca a uma caixa em volta da loja, para não achar a "Rua 6" de outra cidade.
  const g = 0.3;
  const q = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "br",
    "accept-language": "pt-BR",
    viewbox: `${origem.lon - g},${origem.lat + g},${origem.lon + g},${origem.lat - g}`,
    bounded: "1",
    ...params,
  });
  const r = await naFila(() =>
    buscarJSON<{ lat: string; lon: string }[]>(`https://nominatim.openstreetmap.org/search?${q}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    }),
  );
  if (!r?.[0]) return null;
  const c = { lat: Number(r[0].lat), lon: Number(r[0].lon) };
  return dentroDaArea(c, origem) ? c : null;
}

/** Rua com número → rua sem número → só o bairro (aproximado). */
async function geocodificarPorNome(
  e: EnderecoFrete,
  origem: Coord,
): Promise<(Coord & { aproximado: boolean }) | null> {
  const estado = e.uf.toUpperCase() === "SP" ? "São Paulo" : e.uf;
  const tentativas: [Record<string, string>, boolean][] = [];
  // "Rua 7", "Rua Dois", "Rua A"… existem em vários bairros: a busca por nome acharia a rua errada.
  if (!ruaGenerica(e.rua) && e.rua && e.numero)
    tentativas.push([
      { street: `${e.numero} ${e.rua}`, city: e.cidade, state: estado, country: "Brasil" },
      false,
    ]);
  if (!ruaGenerica(e.rua) && e.rua)
    tentativas.push([{ street: e.rua, city: e.cidade, state: estado, country: "Brasil" }, false]);
  if (e.bairro) tentativas.push([{ q: `${e.bairro}, ${e.cidade}, ${e.uf}, Brasil` }, true]);
  for (const [params, aproximado] of tentativas) {
    const c = await nominatim(params, origem);
    if (c) return { ...c, aproximado };
  }
  return null;
}

// ---------- origem ----------
// Coordenadas da loja: vêm do ambiente (LOJA_LAT/LOJA_LON). Sem elas, localiza o CEP de origem uma única vez.
let origemMemo: Promise<Coord> | null = null;
function origem(): Promise<Coord> {
  const doAmbiente = coordsDoAmbiente();
  if (doAmbiente) return Promise.resolve(doAmbiente);
  origemMemo ??= (async () => {
    console.warn("LOJA_LAT/LOJA_LON não configuradas: localizando o CEP de origem.");
    // Centro aproximado de Mogi Mirim só para delimitar a busca; nunca é usado como origem.
    const referencia = { lat: -22.4319, lon: -46.9578 };
    const c = await coordPorCep(loja.frete.origemCep, loja.frete.origemCidade, referencia);
    if (!c) throw new Error("origem");
    return c;
  })().catch((err) => {
    origemMemo = null;
    throw err;
  });
  return origemMemo;
}

// ---------- rota ----------
async function rotaOsrmKm(a: Coord, b: Coord): Promise<number> {
  const j = await buscarJSON<{ routes?: { distance: number }[] }>(
    `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`,
  );
  if (!j.routes?.[0]) throw new Error("rota");
  return j.routes[0].distance / 1000;
}

/** Endereço em texto para o Google, com o CEP (o Google localiza CEPs brasileiros com precisão). */
function enderecoTexto(e: EnderecoFrete) {
  const rua = [e.rua, e.numero].filter(Boolean).join(", ");
  const cidade = [e.cidade, e.uf].filter(Boolean).join(" - ");
  return [rua, e.bairro, cidade, mascaraCep(e.cep), "Brasil"].filter(Boolean).join(", ");
}

/** Google Routes: localiza o endereço (com CEP) e calcula a rota numa chamada só. */
async function rotaGoogleKm(chave: string, o: Coord, e: EnderecoFrete): Promise<number> {
  const body = {
    origin: { location: { latLng: { latitude: o.lat, longitude: o.lon } } },
    destination: { address: enderecoTexto(e) },
    travelMode: "DRIVE",
    languageCode: "pt-BR",
  };
  const j = await buscarJSON<{ routes?: { distanceMeters?: number }[] }>(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": chave,
        "X-Goog-FieldMask": "routes.distanceMeters",
      },
      body: JSON.stringify(body),
    },
  );
  const m = j.routes?.[0]?.distanceMeters;
  if (!m) throw new Error("rota");
  return m / 1000;
}

/** Calcula a taxa. Lança erro se algum passo falhar (o cliente mostra "a confirmar"). */
export async function calcularFreteServidor(e: EnderecoFrete): Promise<ResultadoFrete> {
  const chave = await chaveCache(e);
  const emCache = lerCache(chave);
  if (emCache) return emCache;

  const o = await origem();
  const google = process.env.GOOGLE_MAPS_API_KEY;

  let km: number;
  let aproximado = false;
  if (google) {
    km = await rotaGoogleKm(google, o, e);
  } else {
    const porCep = await coordPorCep(e.cep, e.cidade, o);
    const porNome = porCep ? null : await geocodificarPorNome(e, o);
    const destino = porCep ?? porNome;
    if (!destino) throw new Error("geocodificacao");
    aproximado = porNome?.aproximado ?? false;
    km = await rotaOsrmKm(o, destino);
  }
  if (km > loja.frete.rotaMaxKm) throw new Error("rota_improvavel");

  const resultado = { ...calcularFrete(km), aproximado };
  gravarCache(chave, resultado);
  return resultado;
}
