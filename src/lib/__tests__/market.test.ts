import { describe, expect, it } from "vitest";
import bvsp from "./fixtures/yahoo-bvsp.json";
import { fetchMarket, hasMarketData, Market, mergeMarket, parseFocus12m, parseSgsChange, parseSgsLast, parseYahooChart, realRate } from "@/lib/market";

describe("parsers", () => {
  it("parseSgsLast lê o último valor da série do Banco Central", () => {
    expect(parseSgsLast([{ data: "25/11/2026", valor: "13.65" }])).toBe(13.65);
  });
  it("parseSgsLast devolve null para série vazia ou inválida", () => {
    expect(parseSgsLast([])).toBeNull();
    expect(parseSgsLast({ erro: 1 })).toBeNull();
  });
  it("parseSgsChange calcula a variação entre o primeiro e o último valor", () => {
    const r = parseSgsChange([{ valor: "5.00" }, { valor: "5.50" }, { valor: "5.75" }]);
    expect(r?.last).toBe(5.75);
    expect(r?.change12m).toBeCloseTo(15, 6);
  });
  it("parseFocus12m lê a mediana do Focus", () => {
    expect(parseFocus12m({ value: [{ Mediana: 5.4092 }] })).toBe(5.4092);
    expect(parseFocus12m({ value: [] })).toBeNull();
  });
  it("parseYahooChart usa só os fechamentos, ignorando nulos", () => {
    const q = parseYahooChart({ chart: { result: [{ indicators: { quote: [{ close: [100, null, 120, 90] }] } }] } });
    expect(q).not.toBeNull();
    expect(q!.last).toBe(90);
    expect(q!.change12m).toBeCloseTo(-10, 6);
    expect(q!.fromHigh).toBeCloseTo(-25, 6);
  });
  it("parseYahooChart entende a resposta real do Yahoo", () => {
    const q = parseYahooChart(bvsp);
    expect(q!.last).toBeGreaterThan(0);
    expect(q!.fromHigh).toBeLessThanOrEqual(0);
  });
  it("parseYahooChart devolve null quando o Yahoo responde erro", () => {
    expect(parseYahooChart({ chart: { result: null, error: {} } })).toBeNull();
  });
  it("realRate desconta a inflação da Selic", () => {
    expect(realRate(13.75, 5.4092)).toBeCloseTo(7.91, 2);
  });
});

const res = (body: unknown, ok = true) => ({ ok, json: async () => body }) as unknown as Response;

describe("fetchMarket", () => {
  it("monta o que conseguir e lista as fontes que falharam", async () => {
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("bcdata.sgs.432/")) return res([{ valor: "13.75" }]);
      if (url.includes("olinda")) return res({ value: [{ Mediana: 5 }] });
      if (url.includes("yahoo")) throw new Error("blocked");
      return res(null, false);
    }) as typeof fetch;
    const m = await fetchMarket(fetcher, new Date(2026, 10, 27));
    expect(m.selic).toBe(13.75);
    expect(m.ipcaExpect).toBe(5);
    expect(m.realRate).toBeCloseTo(8.33, 2);
    expect(m.indices.ibov).toBeNull();
    expect(m.errors).toEqual(expect.arrayContaining(["ibov", "cdi", "dolar"]));
  });

  it("nunca lança erro, mesmo com todas as fontes fora do ar", async () => {
    const fetcher = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const m = await fetchMarket(fetcher, new Date(2026, 10, 27));
    expect(m.selic).toBeNull();
    expect(m.cdi).toBeNull();
    expect(m.ipca12m).toBeNull();
    expect(m.ipcaExpect).toBeNull();
    expect(m.realRate).toBeNull();
    expect(m.dolar).toBeNull();
    expect(Object.values(m.indices).every((v) => v === null)).toBe(true);
    expect(m.errors).toHaveLength(10);
  });

  it("usa o IPCA de 12 meses quando o Focus não responde", async () => {
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("bcdata.sgs.432/")) return res([{ valor: "10" }]);
      if (url.includes("bcdata.sgs.13522/")) return res([{ valor: "4" }]);
      return res(null, false);
    }) as typeof fetch;
    const m = await fetchMarket(fetcher, new Date(2026, 10, 27));
    expect(m.ipcaExpect).toBe(4);
    expect(m.realRate).toBeCloseTo((1.1 / 1.04 - 1) * 100, 6);
  });

  it("tenta outra consulta quando o Banco Central responde 304 vazio", async () => {
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("bcdata.sgs.4389/dados/ultimos/4")) return res([{ valor: "13.60" }, { valor: "13.65" }]);
      return res(null, false); // inclusive o primeiro pedido do CDI (304 do BCB)
    }) as typeof fetch;
    const m = await fetchMarket(fetcher, new Date(2026, 10, 27));
    expect(m.cdi).toBe(13.65);
    expect(m.errors).not.toContain("cdi");
  });

  it("pede o dólar dos últimos 12 meses no formato de data do Banco Central", async () => {
    const urls: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return res(null, false);
    }) as typeof fetch;
    await fetchMarket(fetcher, new Date(2026, 10, 27));
    expect(urls.some((u) => u.includes("bcdata.sgs.1/dados?formato=json&dataInicial=27/11/2025&dataFinal=27/11/2026"))).toBe(true);
  });
});

function full(updatedAt: string, selic: number): Market {
  const q = { last: 100, change12m: 5, fromHigh: -2 };
  return {
    updatedAt, selic, cdi: 13.65, ipca12m: 4.6, ipcaExpect: 5, realRate: realRate(selic, 5),
    dolar: { last: 5.7, change12m: 7 },
    indices: { ibov: q, sp500: q, bova11: q, ivvb11: q, xfix11: q },
    errors: [],
  };
}
const empty = (updatedAt: string): Market => ({
  updatedAt, selic: null, cdi: null, ipca12m: null, ipcaExpect: null, realRate: null, dolar: null,
  indices: { ibov: null, sp500: null, bova11: null, ivvb11: null, xfix11: null },
  errors: ["selic", "cdi", "ipca12m", "ipcaExpect", "dolar", "ibov", "sp500", "bova11", "ivvb11", "xfix11"],
});

describe("mergeMarket", () => {
  it("completa campos que falharam com o último resultado bom e marca a data", () => {
    const fresh = { ...full("2026-11-28T10:00:00Z", 14), dolar: null, indices: { ...full("", 14).indices, ibov: null } };
    const m = mergeMarket(fresh, full("2026-11-27T10:00:00Z", 13.75));
    expect(m.selic).toBe(14);
    expect(m.dolar).toEqual({ last: 5.7, change12m: 7 });
    expect(m.indices.ibov).toEqual({ last: 100, change12m: 5, fromHigh: -2 });
    expect(m.staleFrom).toBe("2026-11-27T10:00:00Z");
  });
  it("não marca data antiga quando nada precisou ser completado", () => {
    const m = mergeMarket(full("2026-11-28T10:00:00Z", 14), full("2026-11-27T10:00:00Z", 13.75));
    expect(m.staleFrom).toBeUndefined();
    expect(m).toEqual(full("2026-11-28T10:00:00Z", 14));
  });
  it("recalcula o juro real com a Selic nova e a inflação guardada", () => {
    const fresh = { ...full("2026-11-28T10:00:00Z", 14), ipcaExpect: null, realRate: null };
    const m = mergeMarket(fresh, full("2026-11-27T10:00:00Z", 13.75));
    expect(m.ipcaExpect).toBe(5);
    expect(m.realRate).toBeCloseTo(realRate(14, 5), 6);
  });
});

describe("hasMarketData", () => {
  it("é falso quando todas as fontes falharam", () => {
    expect(hasMarketData(empty("2026-11-28T10:00:00Z"))).toBe(false);
    expect(hasMarketData(full("2026-11-28T10:00:00Z", 14))).toBe(true);
    expect(hasMarketData({ ...empty("x"), selic: 14 })).toBe(true);
  });
  it("rejeita formatos inesperados", () => {
    expect(hasMarketData(null)).toBe(false);
    expect(hasMarketData({ selic: 14 })).toBe(false);
  });
});
