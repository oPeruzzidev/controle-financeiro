import { describe, expect, it } from "vitest";
import { sanitize } from "@/lib/store";

const base = { fixed: [], expenses: [], payslips: [] };

describe("sanitize", () => {
  it("mantém backup antigo sem campos novos", () => {
    const s = sanitize({ ...base, incomes: [{ id: "a", desc: "Freela", amount: 500, type: "unica", month: "2026-10" }] });
    expect(s.incomes).toEqual([{ id: "a", desc: "Freela", amount: 500, type: "unica", month: "2026-10" }]);
    expect(s.incomes[0]).not.toHaveProperty("date");
    expect(s.incomes[0]).not.toHaveProperty("source");
    expect(s.invest).toBeUndefined();
  });

  it("aceita date e source válidos na renda extra", () => {
    const s = sanitize({ ...base, incomes: [{ id: "a", desc: "Freela", amount: 500, type: "unica", month: "2026-10", date: "2026-10-15", source: "Freelance" }] });
    expect(s.incomes[0].date).toBe("2026-10-15");
    expect(s.incomes[0].source).toBe("Freelance");
  });

  it("descarta date de outro mês e source desconhecida", () => {
    const s = sanitize({ ...base, incomes: [{ id: "a", desc: "x", amount: 1, type: "unica", month: "2026-10", date: "2026-09-15", source: "Hack" }] });
    expect(s.incomes[0]).not.toHaveProperty("date");
    expect(s.incomes[0]).not.toHaveProperty("source");
  });

  it("normaliza invest", () => {
    const s = sanitize({ ...base, incomes: [], invest: { profile: "x", invested: "-5", reserve: 1000, goalMonthly: 0, realReturn: 50 } });
    expect(s.invest).toEqual({ invested: 0, reserve: 1000 });
  });

  it("mantém invest válido completo", () => {
    const s = sanitize({ ...base, incomes: [], invest: { profile: "moderado", invested: 2500.5, reserve: 300, goalMonthly: 2000, realReturn: 4.5 } });
    expect(s.invest).toEqual({ profile: "moderado", invested: 2500.5, reserve: 300, goalMonthly: 2000, realReturn: 4.5 });
  });

  it("ignora invest que não é objeto", () => {
    expect(sanitize({ ...base, incomes: [], invest: "lixo" }).invest).toBeUndefined();
  });
});
