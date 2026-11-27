import { describe, expect, it } from "vitest";
import { monthShortLabel } from "@/lib/format";

describe("monthShortLabel", () => {
  it("formata mês abreviado com ano", () => {
    expect(monthShortLabel("2026-11")).toBe("Nov 2026");
    expect(monthShortLabel("2026-03")).toBe("Mar 2026");
  });
});
