export type Group = "need" | "want" | "save";

export interface Category {
  name: string;
  group: Group;
  color: string;
  emoji: string;
}

export const CATEGORIES: Category[] = [
  { name: "Moradia", group: "need", color: "#10b981", emoji: "🏠" },
  { name: "Alimentação", group: "need", color: "#22c55e", emoji: "🛒" },
  { name: "Transporte", group: "need", color: "#3b82f6", emoji: "🚗" },
  { name: "Saúde", group: "need", color: "#ec4899", emoji: "💊" },
  { name: "Educação", group: "need", color: "#8b5cf6", emoji: "🎓" },
  { name: "Dívidas", group: "need", color: "#ef4444", emoji: "💳" },
  { name: "Lazer", group: "want", color: "#f97316", emoji: "🎉" },
  { name: "Compras", group: "want", color: "#eab308", emoji: "🛍️" },
  { name: "Assinaturas", group: "want", color: "#06b6d4", emoji: "📺" },
  { name: "Outros", group: "want", color: "#64748b", emoji: "📦" },
  { name: "Investimentos", group: "save", color: "#84cc16", emoji: "📈" },
];

export const CAT: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.name, c]),
);

export interface Income {
  id: string;
  desc: string;
  amount: number;
  type: "recorrente" | "unica";
  month: string; // YYYY-MM (início, se recorrente)
}
export interface FixedBill {
  id: string;
  desc: string;
  amount: number;
  category: string;
  dueDay: number;
  from: string; // YYYY-MM
}
export interface Expense {
  id: string;
  desc: string;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
}
export interface Payslip {
  id: string;
  month: string;
  gross: number;
  net: number;
  inss: number;
  irrf: number;
  fgts: number;
}
export interface AppData {
  incomes: Income[];
  fixed: FixedBill[];
  expenses: Expense[];
  payslips: Payslip[];
}
export const emptyData = (): AppData => ({
  incomes: [],
  fixed: [],
  expenses: [],
  payslips: [],
});
