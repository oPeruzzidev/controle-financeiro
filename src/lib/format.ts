const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (v: number) => brl.format(isFinite(v) ? v : 0);
export const moneyCompact = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "BRL",
  }).format(isFinite(v) ? v : 0);
export const pct = (v: number, d = 1) =>
  (isFinite(v) ? v : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }) + "%";

const pad = (n: number) => String(n).padStart(2, "0");
export const monthKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const todayISO = () => {
  const d = new Date();
  return `${monthKeyOf(d)}-${pad(d.getDate())}`;
};
export const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split("-").map(Number);
  return monthKeyOf(new Date(y, m - 1 + delta, 1));
};
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const n = MONTHS[m - 1];
  return `${n[0].toUpperCase()}${n.slice(1)} de ${y}`;
};
export const shortMonth = (key: string) => MONTHS[Number(key.split("-")[1]) - 1].slice(0, 3);
/** "2026-11" → "Nov 2026" */
export const monthShortLabel = (key: string) => {
  const s = shortMonth(key);
  return `${s[0].toUpperCase()}${s.slice(1)} ${key.slice(0, 4)}`;
};
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
