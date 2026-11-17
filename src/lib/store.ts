"use client";
import { useSyncExternalStore } from "react";
import { AppData, CAT, emptyData } from "./types";
import { uid } from "./format";

const KEY = "controle-financeiro:v2";
const SERVER: AppData = emptyData();
let data: AppData = SERVER;
let loaded = false;
const listeners = new Set<() => void>();

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFinite(n) ? n : 0;
};
const MRE = /^\d{4}-\d{2}$/;
const DRE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 60) => String(v ?? "").slice(0, max);

/* eslint-disable @typescript-eslint/no-explicit-any */
export function sanitize(raw: any): AppData {
  const s = emptyData();
  if (!raw || typeof raw !== "object") return s;
  for (const x of Array.isArray(raw.incomes) ? raw.incomes : [])
    if (x && num(x.amount) > 0 && MRE.test(x.month ?? ""))
      s.incomes.push({ id: str(x.id, 40) || uid(), desc: str(x.desc), amount: num(x.amount), type: x.type === "unica" ? "unica" : "recorrente", month: x.month });
  for (const x of Array.isArray(raw.fixed) ? raw.fixed : [])
    if (x && num(x.amount) > 0 && MRE.test(x.from ?? ""))
      s.fixed.push({ id: str(x.id, 40) || uid(), desc: str(x.desc), amount: num(x.amount), category: CAT[x.category] ? x.category : "Outros", dueDay: Math.min(31, Math.max(0, Math.trunc(num(x.dueDay)))), from: x.from });
  for (const x of Array.isArray(raw.expenses) ? raw.expenses : [])
    if (x && num(x.amount) > 0 && DRE.test(x.date ?? ""))
      s.expenses.push({ id: str(x.id, 40) || uid(), desc: str(x.desc), amount: num(x.amount), category: CAT[x.category] ? x.category : "Outros", date: x.date });
  for (const x of Array.isArray(raw.payslips) ? raw.payslips : [])
    if (x && MRE.test(x.month ?? ""))
      s.payslips.push({ id: str(x.id, 40) || uid(), month: x.month, gross: num(x.gross), net: num(x.net), inss: num(x.inss), irrf: num(x.irrf), fgts: num(x.fgts) });
  return s;
}

function ensure() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = sanitize(JSON.parse(raw));
    else data = emptyData();
  } catch {
    data = emptyData();
  }
}
function emit() {
  listeners.forEach((l) => l());
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* armazenamento indisponível */
  }
}

export function useData(): AppData {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      ensure();
      return data;
    },
    () => SERVER,
  );
}

export function update(fn: (d: AppData) => AppData) {
  ensure();
  data = fn(data);
  persist();
  emit();
}
export function replaceAll(d: AppData) {
  ensure();
  data = d;
  persist();
  emit();
}
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
