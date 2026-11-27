/**
 * Dados públicos de mercado (Banco Central + Yahoo Finance).
 * Roda no servidor (rota /api/mercado); não recebe nem envia dados pessoais.
 */

export interface IndexQuote {
  last: number;
  change12m: number; // % em 12 meses
  fromHigh: number; // % abaixo (negativo) da máxima de 12 meses
}
export type IndexKey = "ibov" | "sp500" | "bova11" | "ivvb11" | "xfix11";
export interface Market {
  updatedAt: string; // ISO
  selic: number | null; // % a.a. (meta)
  cdi: number | null; // % a.a.
  ipca12m: number | null; // % acumulado 12 meses
  ipcaExpect: number | null; // % esperado 12 meses à frente (Focus)
  realRate: number | null; // % a.a.
  dolar: { last: number; change12m: number } | null;
  indices: Record<IndexKey, IndexQuote | null>;
  errors: string[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toNum = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};
const sgsValues = (json: unknown): number[] =>
  Array.isArray(json) ? json.map((x: any) => toNum(x?.valor)).filter((n): n is number => n !== null) : [];

export function parseSgsLast(json: unknown): number | null {
  const v = sgsValues(json);
  return v.length ? v[v.length - 1] : null;
}

export function parseSgsChange(json: unknown): { last: number; change12m: number } | null {
  const v = sgsValues(json);
  if (v.length < 2 || v[0] <= 0) return null;
  const last = v[v.length - 1];
  return { last, change12m: (last / v[0] - 1) * 100 };
}

export function parseFocus12m(json: unknown): number | null {
  const first = (json as any)?.value?.[0];
  return first ? toNum(first.Mediana) : null;
}

export function parseYahooChart(json: unknown): IndexQuote | null {
  const closes = (json as any)?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(closes)) return null;
  const v = closes.map(toNum).filter((n): n is number => n !== null && n > 0);
  if (v.length < 2) return null;
  const last = v[v.length - 1];
  return { last, change12m: (last / v[0] - 1) * 100, fromHigh: (last / Math.max(...v) - 1) * 100 };
}

export const realRate = (selicPct: number, ipcaPct: number) => ((1 + selicPct / 100) / (1 + ipcaPct / 100) - 1) * 100;

// O BCB às vezes responde "304" vazio a `ultimos/1` sem pedido condicional; pedimos 3 e, se falhar, 4.
const SGS = (n: number) => [3, 4].map((k) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${n}/dados/ultimos/${k}?formato=json`);
const pad = (n: number) => String(n).padStart(2, "0");
const brDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const FOCUS =
  "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoInflacao12Meses?$top=1&$filter=" +
  encodeURIComponent("Indicador eq 'IPCA' and Suavizada eq 'S' and baseCalculo eq 0") +
  "&$orderby=" + encodeURIComponent("Data desc") + "&$format=json&$select=Mediana";
const YAHOO: Record<IndexKey, string> = { ibov: "^BVSP", sp500: "^GSPC", bova11: "BOVA11.SA", ivvb11: "IVVB11.SA", xfix11: "XFIX11.SA" };
const yahooUrl = (s: string) => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=1y&interval=1mo`;

/** Busca todas as fontes em paralelo. Cada uma pode falhar sozinha; nunca lança erro. */
export async function fetchMarket(fetcher: typeof fetch = fetch, now: Date = new Date()): Promise<Market> {
  const errors: string[] = [];
  const init = { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0" } } as RequestInit;
  /** Tenta cada URL em ordem até uma responder 200 com o formato esperado. */
  async function get<T>(key: string, urls: string | string[], parse: (json: unknown) => T | null): Promise<T | null> {
    for (const url of Array.isArray(urls) ? urls : [urls]) {
      try {
        const r = await fetcher(url, init);
        if (!r.ok) continue;
        const v = parse(await r.json());
        if (v !== null) return v;
      } catch {
        /* tenta a próxima URL */
      }
    }
    errors.push(key);
    return null;
  }
  const yearAgo = new Date(now.getTime() - 365 * 86400000);
  const dolarUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados?formato=json&dataInicial=${brDate(yearAgo)}&dataFinal=${brDate(now)}`;
  const keys = Object.keys(YAHOO) as IndexKey[];
  const [selic, cdi, ipca12m, focus, dolar, ...quotes] = await Promise.all([
    get("selic", SGS(432), parseSgsLast),
    get("cdi", SGS(4389), parseSgsLast),
    get("ipca12m", SGS(13522), parseSgsLast),
    get("ipcaExpect", FOCUS, parseFocus12m),
    get("dolar", dolarUrl, parseSgsChange),
    ...keys.map((k) => get(k, yahooUrl(YAHOO[k]), parseYahooChart)),
  ]);
  const ipcaExpect = (focus as number | null) ?? (ipca12m as number | null);
  return {
    updatedAt: now.toISOString(),
    selic: selic as number | null,
    cdi: cdi as number | null,
    ipca12m: ipca12m as number | null,
    ipcaExpect,
    realRate: selic != null && ipcaExpect != null ? realRate(selic as number, ipcaExpect) : null,
    dolar: dolar as Market["dolar"],
    indices: Object.fromEntries(keys.map((k, i) => [k, quotes[i] as IndexQuote | null])) as Market["indices"],
    errors,
  };
}
