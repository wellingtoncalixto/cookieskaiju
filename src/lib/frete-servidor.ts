import "server-only";
import { loja } from "@/config/loja";
import { normalizar, soDigitos } from "@/lib/formato";
import { calcularFrete } from "@/lib/frete";

/**
 * Cálculo da distância de rota no servidor.
 *
 * Provedor padrão: Nominatim (OpenStreetMap) para geocodificar + OSRM para a rota.
 * Com GOOGLE_MAPS_API_KEY definida, usa a Google Routes API (mesma fonte que a loja usa para conferir).
 *
 * Privacidade: os endereços recebidos NÃO são gravados nem registrados em log.
 * O cache em memória guarda só o resultado numérico, indexado por um hash do endereço.
 */

export type EnderecoFrete = { rua: string; numero: string; bairro: string; cidade: string; uf: string };
export type ResultadoFrete = { km1Decimal: number; kmCobrado: number; valor: number; aproximado: boolean };
type Coord = { lat: number; lon: number };

const TIMEOUT_MS = 9000;
const CACHE_TTL_MS = 6 * 3600_000;
const CACHE_MAX = 500;
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT || "CookiesKaiju/1.0 (contato: WhatsApp +55 19 98426-8415)";

// ---------- cache (por hash do endereço normalizado) ----------
const cache = new Map<string, { expira: number; valor: ResultadoFrete }>();

async function chaveCache(e: EnderecoFrete) {
  const texto = [e.rua, e.numero, e.bairro, e.cidade, e.uf].map(normalizar).join("|");
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

async function nominatim(params: Record<string, string>): Promise<Coord | null> {
  const q = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "br",
    "accept-language": "pt-BR",
    ...params,
  });
  const r = await naFila(() =>
    buscarJSON<{ lat: string; lon: string }[]>(`https://nominatim.openstreetmap.org/search?${q}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    }),
  );
  return r?.[0] ? { lat: Number(r[0].lat), lon: Number(r[0].lon) } : null;
}

/** Rua com número → rua sem número → só o bairro (aproximado). */
async function geocodificar(e: EnderecoFrete): Promise<(Coord & { aproximado: boolean }) | null> {
  const estado = e.uf.toUpperCase() === "SP" ? "São Paulo" : e.uf;
  const tentativas: [Record<string, string>, boolean][] = [];
  if (e.rua && e.numero)
    tentativas.push([
      { street: `${e.numero} ${e.rua}`, city: e.cidade, state: estado, country: "Brasil" },
      false,
    ]);
  if (e.rua) tentativas.push([{ street: e.rua, city: e.cidade, state: estado, country: "Brasil" }, false]);
  if (e.bairro) tentativas.push([{ q: `${e.bairro}, ${e.cidade}, ${e.uf}, Brasil` }, true]);
  for (const [params, aproximado] of tentativas) {
    const c = await nominatim(params);
    if (c) return { ...c, aproximado };
  }
  return null;
}

function coordsDoAmbiente(): Coord | null {
  const lat = Number(process.env.LOJA_LAT);
  const lon = Number(process.env.LOJA_LON);
  return process.env.LOJA_LAT && process.env.LOJA_LON && Number.isFinite(lat) && Number.isFinite(lon)
    ? { lat, lon }
    : null;
}

// Coordenadas da loja: vêm do ambiente (LOJA_LAT/LOJA_LON). Sem elas, geocodifica o CEP uma única vez.
let origemMemo: Promise<Coord> | null = null;
function origem(): Promise<Coord> {
  const doAmbiente = coordsDoAmbiente();
  if (doAmbiente) return Promise.resolve(doAmbiente);
  origemMemo ??= (async () => {
    // Busca a rua do CEP no ViaCEP e geocodifica a rua (ou o bairro). Não cai no centro da
    // cidade, para não cobrar uma taxa errada sem ninguém perceber.
    console.warn("LOJA_LAT/LOJA_LON não configuradas: geocodificando o CEP de origem.");
    const v = await buscarJSON<{ erro?: boolean; logradouro?: string; bairro?: string; localidade?: string }>(
      `https://viacep.com.br/ws/${soDigitos(loja.frete.origemCep)}/json/`,
    );
    if (v.erro) throw new Error("origem");
    const c = await geocodificar({
      rua: v.logradouro ?? "",
      numero: "",
      bairro: v.bairro ?? "",
      cidade: v.localidade || loja.frete.origemCidade,
      uf: loja.uf,
    });
    if (!c) throw new Error("origem");
    return { lat: c.lat, lon: c.lon };
  })().catch((err) => {
    origemMemo = null;
    throw err;
  });
  return origemMemo;
}

async function rotaOsrmKm(a: Coord, b: Coord): Promise<number> {
  const j = await buscarJSON<{ routes?: { distance: number }[] }>(
    `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`,
  );
  if (!j.routes?.[0]) throw new Error("rota");
  return j.routes[0].distance / 1000;
}

async function rotaGoogleKm(chave: string, e: EnderecoFrete): Promise<number> {
  const c = coordsDoAmbiente();
  const body = {
    origin: c
      ? { location: { latLng: { latitude: c.lat, longitude: c.lon } } }
      : { address: `${loja.frete.origemCep}, ${loja.frete.origemCidade} - ${loja.uf}, Brasil` },
    destination: { address: `${e.rua}, ${e.numero} - ${e.bairro}, ${e.cidade} - ${e.uf}, Brasil` },
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

  let km: number;
  let aproximado = false;
  const google = process.env.GOOGLE_MAPS_API_KEY;
  if (google) {
    km = await rotaGoogleKm(google, e);
  } else {
    const o = await origem();
    const d = await geocodificar(e);
    if (!d) throw new Error("geocodificacao");
    aproximado = d.aproximado;
    km = await rotaOsrmKm(o, d);
  }

  const resultado = { ...calcularFrete(km), aproximado };
  gravarCache(chave, resultado);
  return resultado;
}
