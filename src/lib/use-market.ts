"use client";
import { useEffect, useState } from "react";
import type { Market } from "./market";

const KEY = "cf-market";
type Saved = { savedAt: string; market: Market };
export type MarketStatus = "loading" | "ok" | "cached" | "error";

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Saved) : null;
    return s && s.market && typeof s.savedAt === "string" ? s : null;
  } catch {
    return null;
  }
}

/** Panorama de mercado: busca /api/mercado e guarda o último resultado bom para uso offline. */
export function useMarket(): { market: Market | null; status: MarketStatus; savedAt: string | null } {
  // Começa já com o último resultado salvo (o componente só monta no cliente).
  const [state, setState] = useState<{ market: Market | null; status: MarketStatus; savedAt: string | null }>(() => {
    const saved = readSaved();
    return { market: saved?.market ?? null, status: "loading", savedAt: saved?.savedAt ?? null };
  });

  useEffect(() => {
    let alive = true;
    const saved = readSaved();
    fetch("/api/mercado")
      .then((r) => (r.ok ? (r.json() as Promise<Market>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((market) => {
        const savedAt = new Date().toISOString();
        try {
          localStorage.setItem(KEY, JSON.stringify({ savedAt, market }));
        } catch {
          /* armazenamento indisponível */
        }
        if (alive) setState({ market, status: "ok", savedAt });
      })
      .catch(() => {
        if (alive) setState(saved ? { market: saved.market, status: "cached", savedAt: saved.savedAt } : { market: null, status: "error", savedAt: null });
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
