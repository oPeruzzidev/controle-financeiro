import { AppData, CAT, CATEGORIES, Income } from "./types";
import { money, pct, shiftMonth } from "./format";

export const incomesFor = (d: AppData, m: string) =>
  d.incomes.filter((i) => (i.type === "recorrente" ? i.month <= m : i.month === m));
export const fixedFor = (d: AppData, m: string) => d.fixed.filter((f) => f.from <= m);
export const expensesFor = (d: AppData, m: string) =>
  d.expenses.filter((e) => e.date.slice(0, 7) === m);
const sum = (a: { amount: number }[]) => a.reduce((s, x) => s + x.amount, 0);

/** Renda do mês separada em fixa (recorrente) e extra (única). */
export function incomeSplit(d: AppData, m: string) {
  const list = incomesFor(d, m);
  return {
    fixed: sum(list.filter((i) => i.type === "recorrente")),
    extra: sum(list.filter((i) => i.type === "unica")),
  };
}

/** Data de uma renda extra; extras antigos sem data caem no dia 1 do mês. */
export const extraDate = (i: Income) => i.date ?? `${i.month}-01`;

/** Média mensal dos extras nos últimos `months` meses (inclui o mês m). */
export function extraAverage(d: AppData, m: string, months = 6) {
  let total = 0;
  for (let k = 0; k < months; k++) total += incomeSplit(d, shiftMonth(m, -k)).extra;
  return total / months;
}

export interface Computed {
  month: string;
  income: number;
  fixedTotal: number;
  varTotal: number;
  byCat: Record<string, number>;
  need: number;
  want: number;
  save: number;
  consumo: number; // necessidades + desejos
  outflow: number; // consumo + investimentos
  balance: number; // renda - saídas
  poupado: number; // renda - consumo (investido + sobra)
  hasData: boolean;
}

export function compute(d: AppData, m: string): Computed {
  const income = sum(incomesFor(d, m));
  const fx = fixedFor(d, m);
  const ex = expensesFor(d, m);
  const byCat: Record<string, number> = Object.fromEntries(CATEGORIES.map((c) => [c.name, 0]));
  fx.forEach((f) => (byCat[f.category] = (byCat[f.category] ?? 0) + f.amount));
  ex.forEach((e) => (byCat[e.category] = (byCat[e.category] ?? 0) + e.amount));
  let need = 0, want = 0, save = 0;
  CATEGORIES.forEach((c) => {
    const v = byCat[c.name];
    if (c.group === "need") need += v;
    else if (c.group === "want") want += v;
    else save += v;
  });
  const consumo = need + want;
  const outflow = consumo + save;
  return {
    month: m, income, fixedTotal: sum(fx), varTotal: sum(ex), byCat,
    need, want, save, consumo, outflow,
    balance: income - outflow, poupado: income - consumo,
    hasData: income > 0 || outflow > 0,
  };
}

export type TipLevel = "alert" | "warn" | "info" | "good";
export interface Tip {
  level: TipLevel;
  title: string;
  text: string;
  saving?: number;
}

const LIMITS: Record<string, [number, string]> = {
  Moradia: [30, "Avalie renegociar aluguel/financiamento e reduzir contas da casa (energia, água, condomínio)."],
  Alimentação: [15, "Planeje compras com lista, cozinhe em casa e compare preços; delivery costuma custar 2–3× mais."],
  Transporte: [15, "Compare app × transporte público × carona; revise seguro, combustível e manutenção preventiva."],
  Lazer: [10, "Defina um teto mensal de lazer e procure opções gratuitas ou de baixo custo."],
  Assinaturas: [5, "Liste todas as assinaturas e cancele as que usou menos de 2 vezes no último mês."],
  Compras: [10, "Adote a regra das 48 horas antes de compras não essenciais e evite parcelar supérfluos."],
  Saúde: [12, "Verifique se o plano é adequado ao seu uso e se há genéricos ou coparticipação para economizar."],
};

export function buildTips(c: Computed): Tip[] {
  const t: Tip[] = [];
  if (!c.hasData) {
    return [{ level: "info", title: "Comece cadastrando seus dados", text: "Informe sua renda, suas contas fixas e seus gastos do mês para receber um diagnóstico personalizado." }];
  }
  const inc = c.income;
  if (inc <= 0) {
    return [{ level: "warn", title: "Cadastre sua renda", text: "Há gastos lançados mas nenhuma renda neste mês. Adicione seu salário e outros proventos para calcular os percentuais." }];
  }
  const p = (v: number) => (v / inc) * 100;

  if (c.balance < 0) {
    t.push({ level: "alert", title: "Você gastou mais do que ganhou", text: `O déficit do mês é de ${money(-c.balance)} (${pct(-p(c.balance))} da renda). Priorize cortar gastos variáveis e evite usar crédito para cobrir a diferença.` });
  } else if (p(c.poupado) >= 20) {
    t.push({ level: "good", title: "Ótima taxa de poupança", text: `Você preserva ${pct(p(c.poupado))} da renda (${money(c.poupado)}). Garanta que esse valor esteja investido, não parado na conta corrente.` });
  } else if (p(c.poupado) >= 10) {
    t.push({ level: "warn", title: "Poupança abaixo da meta", text: `Você preserva ${pct(p(c.poupado))} da renda. A meta é 20% (${money(inc * 0.2)}); faltam ${money(inc * 0.2 - c.poupado)} por mês.` });
  } else {
    t.push({ level: "alert", title: "Quase nada sobra no mês", text: `Apenas ${pct(p(c.poupado))} da renda fica livre. Automatize uma transferência para poupança assim que o salário cair, mesmo que pequena.` });
  }
  if (p(c.need) > 50) t.push({ level: "warn", title: "Necessidades acima de 50%", text: `Moradia, alimentação, transporte, saúde, educação e dívidas somam ${pct(p(c.need))} da renda. Renegocie contratos (internet, seguros, planos) e compare fornecedores.` });
  if (p(c.want) > 30) {
    const cut = c.want * 0.15;
    t.push({ level: "warn", title: "Desejos acima de 30%", text: `Lazer, compras, assinaturas e outros somam ${pct(p(c.want))} da renda. Reduzir 15% disso libera ${money(cut)} por mês (${money(cut * 12)} por ano).`, saving: cut });
  }
  if (p(c.fixedTotal) > 50) t.push({ level: "warn", title: "Orçamento muito engessado", text: `Contas fixas consomem ${pct(p(c.fixedTotal))} da renda, deixando pouca margem para imprevistos. Revise as maiores e veja o que dá para renegociar ou cancelar.` });
  for (const [k, [lim, advice]] of Object.entries(LIMITS)) {
    const v = c.byCat[k];
    if (v > 0 && p(v) > lim) t.push({ level: "warn", title: `${k} pesa ${pct(p(v))} da renda`, text: `A referência é até ${lim}%. ${advice}`, saving: v - (inc * lim) / 100 });
  }
  const debt = c.byCat["Dívidas"];
  if (debt > 0) {
    if (p(debt) > 15) t.push({ level: "alert", title: `Dívidas comprometem ${pct(p(debt))} da renda`, text: "Acima de 15% é sinal de alerta. Quite primeiro as de juros mais altos (cartão, cheque especial) e busque renegociação ou portabilidade." });
    else t.push({ level: "info", title: "Você tem dívidas no orçamento", text: `Elas consomem ${pct(p(debt))} da renda. Direcione qualquer sobra para quitar primeiro as de maior juro.` });
  }
  if (c.byCat["Investimentos"] <= 0 && c.balance > 0) {
    t.push({ level: "info", title: "Transforme a sobra em investimento", text: `Você tem ${money(c.balance)} sobrando e nada registrado como investimento. Monte uma reserva de emergência (6 meses de gastos ≈ ${money(c.consumo * 6)}) em aplicação com liquidez diária.` });
  } else if (c.consumo > 0) {
    const monthly = Math.max(inc * 0.1, 1);
    t.push({ level: "info", title: "Reserva de emergência", text: `O ideal é ter ~6 meses de gastos guardados: ≈ ${money(c.consumo * 6)}. Guardando ${money(monthly)} por mês você chega lá em ${Math.ceil((c.consumo * 6) / monthly)} meses.` });
  }
  const top = Object.keys(c.byCat)
    .filter((k) => CAT[k].group !== "save" && c.byCat[k] > 0)
    .sort((a, b) => c.byCat[b] - c.byCat[a])[0];
  if (top) t.push({ level: "info", title: `Maior categoria: ${top}`, text: `Consome ${pct(p(c.byCat[top]))} da renda (${money(c.byCat[top])}). Reduzir 10% dela economiza ${money(c.byCat[top] * 0.1)} por mês.`, saving: c.byCat[top] * 0.1 });
  const order: Record<string, number> = { alert: 0, warn: 1, info: 2, good: 3 };
  return t.sort((a, b) => order[a.level] - order[b.level]);
}

/** Maior economia individual sugerida (evita somar dicas sobrepostas). */
export const potentialSavings = (tips: Tip[]) =>
  tips.reduce((mx, t) => Math.max(mx, t.saving ?? 0), 0);
