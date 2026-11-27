import { describe, expect, it } from "vitest";
import {
  aportesInMonth,
  APORTE_INVEST,
  APORTE_RESERVA,
  monthPlan,
  tiltInputsComplete,
  applyTilts,
  BASE_WEIGHTS,
  extrasHint,
  futureValue,
  monthlyIncomeFrom,
  profileFromAnswers,
  reserveTarget,
  suggestAllocation,
  Weights,
  yearsToGoal,
} from "@/lib/invest";
import type { IndexKey, IndexQuote, Market } from "@/lib/market";
import { AppData, emptyData, Profile } from "@/lib/types";

/** Market com tudo null, sobrescrito pelo que o teste informar. */
function mk(p: { realRate?: number; dolar?: { change12m: number }; indices?: Partial<Record<IndexKey, Partial<IndexQuote>>> } = {}): Market {
  const q = (x?: Partial<IndexQuote>) => (x ? { last: 1, change12m: 0, fromHigh: 0, ...x } : null);
  return {
    updatedAt: "",
    selic: null,
    cdi: null,
    ipca12m: null,
    ipcaExpect: null,
    realRate: p.realRate ?? null,
    dolar: p.dolar ? { last: 1, ...p.dolar } : null,
    indices: { ibov: q(p.indices?.ibov), sp500: q(p.indices?.sp500), bova11: q(p.indices?.bova11), ivvb11: q(p.indices?.ivvb11), xfix11: q(p.indices?.xfix11) },
    errors: [],
  };
}
const total = (w: Weights) => Object.values(w).reduce((s, v) => s + v, 0);
const nbsp = (s: string | null) => (s ?? "").replace(/ /g, " ");

describe("perfil", () => {
  it("pesos de cada perfil somam 100", () => {
    for (const p of Object.keys(BASE_WEIGHTS) as Profile[]) expect(total(BASE_WEIGHTS[p])).toBe(100);
  });
  it("profileFromAnswers classifica pela soma de pontos", () => {
    expect(profileFromAnswers([0, 1, 1])).toBe("conservador");
    expect(profileFromAnswers([1, 1, 1])).toBe("moderado");
    expect(profileFromAnswers([2, 2, 1])).toBe("arrojado");
  });
});

describe("applyTilts", () => {
  it("sem dados de mercado mantém os pesos e não explica nada", () => {
    const r = applyTilts(BASE_WEIGHTS.moderado, null);
    expect(r.weights).toEqual(BASE_WEIGHTS.moderado);
    expect(r.reasons).toEqual([]);
  });
  it("juro real alto move 5 pontos de ações para IPCA+", () => {
    const r = applyTilts(BASE_WEIGHTS.moderado, mk({ realRate: 8.7 }));
    expect(r.weights.ipca).toBe(35);
    expect(r.weights.acoes).toBe(10);
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons[0]).toMatch(/juro real/i);
  });
  it("nunca deixa peso negativo", () => {
    const r = applyTilts({ pos: 2, ipca: 50, fii: 20, acoes: 3, exterior: 25 }, mk({ realRate: 3 }));
    expect(r.weights.pos).toBe(0);
    expect(r.weights.acoes).toBe(5);
    expect(total(r.weights)).toBe(100);
  });
  it("dólar em alta forte tira do exterior e põe em IPCA+", () => {
    const r = applyTilts(BASE_WEIGHTS.moderado, mk({ dolar: { change12m: 16 } }));
    expect(r.weights.exterior).toBe(10);
    expect(r.weights.ipca).toBe(35);
  });
  it("combina gatilhos compatíveis no perfil arrojado", () => {
    const r = applyTilts(BASE_WEIGHTS.arrojado, mk({ realRate: 8.7, indices: { ibov: { fromHigh: -20 }, xfix11: { fromHigh: -12 } }, dolar: { change12m: 16 } }));
    expect(r.weights).toEqual({ pos: 0, ipca: 30, fii: 25, acoes: 25, exterior: 20 });
    expect(r.reasons).toHaveLength(4);
  });
  it("combina gatilhos compatíveis no perfil conservador", () => {
    const r = applyTilts(BASE_WEIGHTS.conservador, mk({ realRate: 3, indices: { ibov: { fromHigh: -20 }, xfix11: { fromHigh: -12 } }, dolar: { change12m: -12 } }));
    expect(r.weights).toEqual({ pos: 20, ipca: 35, fii: 20, acoes: 15, exterior: 10 });
    expect(r.reasons).toHaveLength(4);
  });
});

describe("suggestAllocation", () => {
  it("manda parte para a reserva e divide o resto pelos pesos", () => {
    const a = suggestAllocation({ surplus: 1200, profile: "moderado", reserve: 0, reserveTarget: 8000, market: null });
    expect(a.toReserve).toBe(840);
    expect(a.byClass).toEqual({ pos: 90, ipca: 100, fii: 70, acoes: 50, exterior: 50 });
    expect(a.total).toBe(1200);
  });
  it("com reserva cheia aplica os ajustes do mês", () => {
    const a = suggestAllocation({ surplus: 1000, profile: "moderado", reserve: 9000, reserveTarget: 8000, market: mk({ realRate: 8.7 }) });
    expect(a.toReserve).toBe(0);
    expect(a.byClass).toEqual({ pos: 200, ipca: 350, fii: 200, acoes: 100, exterior: 150 });
  });
  it("mês com déficit não sugere nada", () => {
    const a = suggestAllocation({ surplus: -300, profile: "moderado", reserve: 0, reserveTarget: 8000, market: null });
    expect(a.total).toBe(0);
    expect(a.toReserve).toBe(0);
    expect(Object.values(a.byClass).every((v) => v === 0)).toBe(true);
  });
  it("meta de reserva zero não manda nada para a reserva", () => {
    const a = suggestAllocation({ surplus: 500, profile: "conservador", reserve: 0, reserveTarget: 0, market: null });
    expect(a.toReserve).toBe(0);
    expect(Object.values(a.byClass).reduce((s, v) => s + v, 0)).toBe(500);
  });
  it("sobra menor que R$ 10 vai toda para renda fixa pós", () => {
    const a = suggestAllocation({ surplus: 7, profile: "moderado", reserve: 9000, reserveTarget: 8000, market: null });
    expect(a.byClass).toEqual({ pos: 7, ipca: 0, fii: 0, acoes: 0, exterior: 0 });
  });
});

describe("reserveTarget", () => {
  it("é 6× a média do consumo dos últimos 3 meses com dados", () => {
    const d = emptyData();
    d.expenses = [
      { id: "a", desc: "Mercado", amount: 3000, category: "Alimentação", date: "2026-09-10" },
      { id: "b", desc: "Mercado", amount: 4000, category: "Alimentação", date: "2026-11-10" },
    ];
    expect(reserveTarget(d, "2026-11")).toBe(21000);
  });
  it("é zero sem nenhum gasto", () => {
    expect(reserveTarget(emptyData(), "2026-11")).toBe(0);
  });
});

describe("projeção", () => {
  it("futureValue com juros compostos mensais", () => {
    expect(futureValue(10000, 1000, 4.5, 10)).toBeCloseTo(166005.37, 0);
    expect(futureValue(10000, 1000, 0, 10)).toBe(130000);
  });
  it("monthlyIncomeFrom usa retirada de 4% ao ano", () => {
    expect(monthlyIncomeFrom(600000)).toBe(2000);
  });
  it("yearsToGoal encontra quando a renda atinge a meta", () => {
    expect(yearsToGoal(10000, 1000, 4.5, 2000)).toBe(25.7);
    expect(yearsToGoal(0, 0, 4.5, 2000)).toBeNull();
  });
});

describe("extrasHint", () => {
  it("sugere investir 80% da renda extra", () => {
    expect(extrasHint(0)).toBeNull();
    expect(nbsp(extrasHint(600))).toContain("R$ 480,00");
  });
});

describe("plano do mês", () => {
  function month(): AppData {
    const d = emptyData();
    d.incomes = [{ id: "s", desc: "Salário", amount: 5000, type: "recorrente", month: "2026-11" }];
    d.expenses = [{ id: "g", desc: "Mercado", amount: 3800, category: "Alimentação", date: "2026-11-05" }];
    d.invest = { profile: "moderado", invested: 0, reserve: 0 };
    return d;
  }
  // meta da reserva = 6 × 3800 = 22800

  it("aportesInMonth separa aportes da reserva dos demais investimentos", () => {
    const d = month();
    d.expenses.push(
      { id: "a1", desc: APORTE_RESERVA, amount: 840, category: "Investimentos", date: "2026-11-10" },
      { id: "a2", desc: APORTE_INVEST, amount: 100, category: "Investimentos", date: "2026-11-11" },
      { id: "a3", desc: "Tesouro", amount: 50, category: "Investimentos", date: "2026-11-12" },
      { id: "a4", desc: APORTE_RESERVA, amount: 999, category: "Investimentos", date: "2026-10-12" },
    );
    expect(aportesInMonth(d, "2026-11")).toEqual({ reserve: 840, invest: 150 });
  });

  it("registrar o aporte sugerido não muda a sugestão nem a capacidade do mês", () => {
    const d = month();
    const before = monthPlan(d, "2026-11", null)!;
    expect(before.capacity).toBe(1200);
    expect(before.allocation.toReserve).toBe(840);
    d.expenses.push({ id: "a1", desc: APORTE_RESERVA, amount: 840, category: "Investimentos", date: "2026-11-10" });
    d.invest = { ...d.invest!, reserve: 840 };
    const after = monthPlan(d, "2026-11", null)!;
    expect(after.capacity).toBe(1200);
    expect(after.allocation).toEqual(before.allocation);
    expect(after.remaining).toBe(360);
    expect(after.reserveLeft).toBe(0);
  });

  it("sem perfil não há plano", () => {
    const d = month();
    d.invest = { invested: 0, reserve: 0 };
    expect(monthPlan(d, "2026-11", null)).toBeNull();
  });
});

describe("tiltInputsComplete", () => {
  it("só é verdadeiro com todos os indicadores usados pelas regras", () => {
    expect(tiltInputsComplete(null)).toBe(false);
    expect(tiltInputsComplete(mk({ realRate: 7 }))).toBe(false);
    expect(tiltInputsComplete(mk({ realRate: 7, dolar: { change12m: 1 }, indices: { ibov: {}, xfix11: {} } }))).toBe(true);
  });
});
