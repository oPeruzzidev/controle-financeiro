import { describe, expect, it } from "vitest";
import { compute, extraAverage, extraDate, incomeSplit } from "@/lib/finance";
import { AppData, emptyData } from "@/lib/types";

function data(): AppData {
  const d = emptyData();
  d.incomes = [
    { id: "s", desc: "Salário", amount: 5000, type: "recorrente", month: "2026-01" },
    { id: "e1", desc: "Freela", amount: 600, type: "unica", month: "2026-11", date: "2026-11-10", source: "Freelance" },
    { id: "e2", desc: "Venda", amount: 300, type: "unica", month: "2026-09" },
    { id: "e3", desc: "Bônus", amount: 900, type: "unica", month: "2026-04" },
  ];
  return d;
}

describe("renda fixa × extra", () => {
  it("incomeSplit separa fixa e extra do mês", () => {
    expect(incomeSplit(data(), "2026-11")).toEqual({ fixed: 5000, extra: 600 });
  });

  it("extraAverage faz a média dos últimos 6 meses", () => {
    expect(extraAverage(data(), "2026-11")).toBe(150);
  });

  it("compute continua somando fixa + extra", () => {
    expect(compute(data(), "2026-11").income).toBe(5600);
  });
});

describe("extraDate", () => {
  it("usa o dia 1 do mês quando a renda extra não tem data", () => {
    expect(extraDate({ id: "x", desc: "x", amount: 1, type: "unica", month: "2026-10" })).toBe("2026-10-01");
  });
  it("usa a data informada", () => {
    expect(extraDate({ id: "x", desc: "x", amount: 1, type: "unica", month: "2026-10", date: "2026-10-15" })).toBe("2026-10-15");
  });
});
