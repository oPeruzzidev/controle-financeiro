/**
 * Motor de sugestões de investimento: divide a sobra do mês por classe de ativo
 * a partir do perfil, da reserva de emergência e de ajustes leves de mercado.
 * Tudo puro (sem React, sem rede); roda no aparelho com os dados do usuário.
 */
import { compute } from "./finance";
import { money, pct, shiftMonth } from "./format";
import type { Market } from "./market";
import type { AppData, Profile } from "./types";

export type AssetClass = "pos" | "ipca" | "fii" | "acoes" | "exterior";
export type Weights = Record<AssetClass, number>; // soma 100

export const CLASSES: { id: AssetClass; label: string; example: string; what: string; color: string }[] = [
  { id: "pos", label: "Renda fixa pós", example: "Tesouro Selic, CDB com liquidez diária", what: "Rende perto da Selic e pode ser resgatado a qualquer momento.", color: "#3b82f6" },
  { id: "ipca", label: "Renda fixa inflação", example: "Tesouro IPCA+", what: "Protege da inflação e garante juro real até o vencimento: base da renda futura.", color: "#8b5cf6" },
  { id: "fii", label: "Fundos imobiliários", example: "FIIs ou ETF XFIX11", what: "Distribuem aluguéis todo mês, isentos de IR para pessoa física.", color: "#f97316" },
  { id: "acoes", label: "Ações Brasil", example: "ETF BOVA11 ou ações pagadoras de dividendos", what: "Crescimento de longo prazo e dividendos de empresas brasileiras.", color: "#10b981" },
  { id: "exterior", label: "Exterior", example: "ETF IVVB11 (S&P 500)", what: "Diversifica em dólar com as maiores empresas dos EUA.", color: "#06b6d4" },
];
export const RESERVE_COLOR = "#64748b";

export const BASE_WEIGHTS: Record<Profile, Weights> = {
  conservador: { pos: 40, ipca: 35, fii: 15, acoes: 5, exterior: 5 },
  moderado: { pos: 20, ipca: 30, fii: 20, acoes: 15, exterior: 15 },
  arrojado: { pos: 10, ipca: 20, fii: 20, acoes: 25, exterior: 25 },
};
export const RESERVE_SHARE: Record<Profile, number> = { conservador: 1, moderado: 0.7, arrojado: 0.5 };
export const DEFAULT_REAL_RETURN: Record<Profile, number> = { conservador: 3.5, moderado: 4.5, arrojado: 5.5 };
export const PROFILE_LABEL: Record<Profile, string> = { conservador: "Conservador", moderado: "Moderado", arrojado: "Arrojado" };

export const QUIZ: { q: string; options: { label: string; points: 0 | 1 | 2 }[] }[] = [
  {
    q: "Quando você vai precisar desse dinheiro?",
    options: [
      { label: "Em menos de 2 anos", points: 0 },
      { label: "Entre 2 e 5 anos", points: 1 },
      { label: "Daqui a mais de 5 anos", points: 2 },
    ],
  },
  {
    q: "Se seus investimentos caíssem 20% em um mês, você…",
    options: [
      { label: "Resgataria tudo", points: 0 },
      { label: "Esperaria recuperar", points: 1 },
      { label: "Aproveitaria para investir mais", points: 2 },
    ],
  },
  {
    q: "Qual sua experiência com investimentos?",
    options: [
      { label: "Só poupança", points: 0 },
      { label: "Já investi em renda fixa", points: 1 },
      { label: "Já investi em ações ou FIIs", points: 2 },
    ],
  },
];

export function profileFromAnswers(points: number[]): Profile {
  const s = points.reduce((a, b) => a + b, 0);
  return s <= 2 ? "conservador" : s <= 4 ? "moderado" : "arrojado";
}

/** Meta da reserva: 6× a média do consumo dos últimos 3 meses que têm gastos. */
export function reserveTarget(d: AppData, m: string): number {
  const vals = [0, 1, 2].map((k) => compute(d, shiftMonth(m, -k)).consumo).filter((v) => v > 0);
  return vals.length ? (6 * vals.reduce((a, b) => a + b, 0)) / vals.length : 0;
}

type Tilt = { when: (m: Market) => boolean; from: AssetClass; to: AssetClass; text: (m: Market) => string };
const TILTS: Tilt[] = [
  {
    when: (m) => m.realRate != null && m.realRate > 6,
    from: "acoes",
    to: "ipca",
    text: (m) => `Juro real em ${pct(m.realRate!)} ao ano: títulos atrelados à inflação estão pagando bem, então reforçamos o Tesouro IPCA+.`,
  },
  {
    when: (m) => m.realRate != null && m.realRate < 4,
    from: "pos",
    to: "acoes",
    text: (m) => `Juro real baixo (${pct(m.realRate!)} ao ano): a renda fixa rende pouco acima da inflação, então aumentamos um pouco as ações.`,
  },
  {
    when: (m) => (m.indices.ibov?.fromHigh ?? 0) <= -15,
    from: "pos",
    to: "acoes",
    text: (m) => `Ibovespa está ${pct(-m.indices.ibov!.fromHigh)} abaixo da máxima de 12 meses: ações mais baratas, bom momento para comprar aos poucos.`,
  },
  {
    when: (m) => (m.dolar?.change12m ?? 0) > 15,
    from: "exterior",
    to: "ipca",
    text: (m) => `Dólar subiu ${pct(m.dolar!.change12m)} em 12 meses: investir lá fora ficou caro, então reduzimos um pouco o exterior.`,
  },
  {
    when: (m) => (m.dolar?.change12m ?? 0) < -10,
    from: "pos",
    to: "exterior",
    text: (m) => `Dólar caiu ${pct(-m.dolar!.change12m)} em 12 meses: bom momento para aumentar os investimentos no exterior.`,
  },
  {
    when: (m) => (m.indices.xfix11?.fromHigh ?? 0) <= -10,
    from: "pos",
    to: "fii",
    text: (m) => `Fundos imobiliários estão ${pct(-m.indices.xfix11!.fromHigh)} abaixo da máxima de 12 meses: cotas mais baratas rendem mais aluguel por real investido.`,
  },
];

/** Ajustes do mês: cada regra move no máximo 5 pontos, sem deixar peso negativo. */
export function applyTilts(base: Weights, mk: Market | null): { weights: Weights; reasons: string[] } {
  const weights = { ...base };
  const reasons: string[] = [];
  if (!mk) return { weights, reasons };
  for (const t of TILTS) {
    if (!t.when(mk)) continue;
    const move = Math.min(5, weights[t.from]);
    if (move <= 0) continue;
    weights[t.from] -= move;
    weights[t.to] += move;
    reasons.push(t.text(mk));
  }
  return { weights, reasons };
}

export interface Allocation {
  total: number;
  toReserve: number;
  byClass: Record<AssetClass, number>;
  weights: Weights;
  reasons: string[];
}
const floor10 = (x: number) => Math.floor(x / 10) * 10;

export function suggestAllocation(i: { surplus: number; profile: Profile; reserve: number; reserveTarget: number; market: Market | null }): Allocation {
  const { weights, reasons } = applyTilts(BASE_WEIGHTS[i.profile], i.market);
  const byClass: Record<AssetClass, number> = { pos: 0, ipca: 0, fii: 0, acoes: 0, exterior: 0 };
  if (!(i.surplus > 0)) return { total: 0, toReserve: 0, byClass, weights, reasons };
  const missing = Math.max(0, i.reserveTarget - i.reserve);
  const toReserve = floor10(Math.min(missing, i.surplus * RESERVE_SHARE[i.profile]));
  const rest = i.surplus - toReserve;
  let used = 0;
  for (const c of CLASSES) {
    if (c.id === "pos") continue;
    byClass[c.id] = floor10((rest * weights[c.id]) / 100);
    used += byClass[c.id];
  }
  byClass.pos = rest - used; // fecha o total exato
  return { total: i.surplus, toReserve, byClass, weights, reasons };
}

/** Patrimônio futuro (valores de hoje) com aporte mensal e rentabilidade real anual. */
export function futureValue(invested: number, monthly: number, realReturnPct: number, years: number): number {
  const n = years * 12;
  const r = Math.pow(1 + realReturnPct / 100, 1 / 12) - 1;
  if (r === 0) return invested + monthly * n;
  const g = Math.pow(1 + r, n);
  return invested * g + (monthly * (g - 1)) / r;
}

/** Renda mensal sustentável: retirada de 4% ao ano sobre o patrimônio. */
export const monthlyIncomeFrom = (patrimony: number) => (patrimony * 0.04) / 12;

/** Anos (1 casa) até a renda mensal sustentável alcançar a meta; null se passar de 100 anos. */
export function yearsToGoal(invested: number, monthly: number, realReturnPct: number, goalMonthly: number): number | null {
  const r = Math.pow(1 + realReturnPct / 100, 1 / 12) - 1;
  let p = invested;
  if (monthlyIncomeFrom(p) >= goalMonthly) return 0;
  for (let n = 1; n <= 1200; n++) {
    p = p * (1 + r) + monthly;
    if (monthlyIncomeFrom(p) >= goalMonthly) return Math.round((n / 12) * 10) / 10;
  }
  return null;
}

export function extrasHint(extra: number): string | null {
  if (!(extra > 0)) return null;
  return `Você recebeu ${money(extra)} de renda extra este mês. Como esse dinheiro não estava no orçamento, invista pelo menos 80% dele (${money(extra * 0.8)}).`;
}
