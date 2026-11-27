"use client";
import { useMemo } from "react";
import { buildTips, compute } from "@/lib/finance";
import { money, pct } from "@/lib/format";
import { AppData, CAT } from "@/lib/types";
import { slicesOf } from "./charts";
import { Card, CardTitle, Empty, ProgressBar, TipList } from "./ui";
import { FileBarChart } from "lucide-react";
import { Payslip } from "@/lib/types";

export function payslipTips(p?: Payslip) {
  const t: ReturnType<typeof buildTips> = [];
  if (!p || p.gross <= 0) return t;
  const r = ((p.gross - p.net) / p.gross) * 100;
  if (r > 30) t.push({ level: "warn", title: `Descontos altos no holerite (${pct(r)})`, text: "Mais de 30% do bruto é descontado. Confira se há consignados, pensão, plano de saúde ou previdência privada que possam ser revistos." });
  if (p.irrf > 0) t.push({ level: "info", title: "Imposto de Renda retido na fonte", text: `Você paga ${money(p.irrf)}/mês de IRRF. Declare despesas dedutíveis (saúde, educação, dependentes) e avalie previdência PGBL para reduzir a base tributável.` });
  return t;
}

export function Report({ data, month }: { data: AppData; month: string }) {
  const c = useMemo(() => compute(data, month), [data, month]);
  const latest = useMemo(() => [...data.payslips].sort((a, b) => (a.month < b.month ? 1 : -1))[0], [data.payslips]);
  const tips = useMemo(() => [...buildTips(c), ...payslipTips(latest)], [c, latest]);

  if (!c.hasData) {
    return <Card><Empty icon={<FileBarChart size={22} />} title="Sem dados neste mês" text="Cadastre rendas e gastos para gerar o relatório." /></Card>;
  }
  const base = c.income > 0 ? c.income : c.outflow;
  const rows = slicesOf(c);
  const rule = [
    { t: "Necessidades", goal: 50, v: c.need, low: true, sub: "moradia, alimentação, transporte, saúde, educação, dívidas" },
    { t: "Desejos", goal: 30, v: c.want, low: true, sub: "lazer, compras, assinaturas, outros" },
    { t: "Poupança / sobra", goal: 20, v: Math.max(c.poupado, 0), low: false, sub: "investimentos + o que sobrou" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Relatório do mês</h1>
        <p className="text-sm text-muted">Quanto de cada R$ 100 da sua renda foi para cada destino</p>
      </div>
      <Card>
        <CardTitle sub={c.income > 0 ? `Base: renda de ${money(c.income)}` : "Sem renda cadastrada — base: total gasto"}>Consumo da renda por categoria</CardTitle>
        <div className="flex flex-col gap-4">
          {rows.map((r) => {
            const p = (r.value / base) * 100;
            const cat = CAT[r.name];
            return (
              <div key={r.name}>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium">{cat ? <span>{cat.emoji}</span> : <span>💰</span>} {r.name}</span>
                  <span className="tabular"><b>{pct(p)}</b> <span className="text-muted">· {money(r.value)}</span></span>
                </div>
                <ProgressBar value={p} color={r.color} />
              </div>
            );
          })}
        </div>
        {c.income > 0 && c.outflow > c.income && (
          <p className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">Suas saídas equivalem a {pct((c.outflow / c.income) * 100)} da renda: déficit de {money(c.outflow - c.income)}.</p>
        )}
      </Card>

      <Card>
        <CardTitle sub="Referência popular de equilíbrio financeiro">Regra 50 / 30 / 20</CardTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          {rule.map((r) => {
            const p = (r.v / base) * 100;
            const ok = r.low ? p <= r.goal : p >= r.goal;
            return (
              <div key={r.t} className="rounded-xl border border-line bg-surface-2 p-4">
                <div className="text-[13px] text-muted">{r.t} · meta {r.low ? "≤" : "≥"} {r.goal}%</div>
                <div className={`tabular mt-1 text-3xl font-semibold tracking-tight ${ok ? "text-ok" : "text-warn"}`}>{pct(p)}</div>
                <div className="tabular text-xs text-muted">{money(r.v)} · ideal {money((base * r.goal) / 100)}</div>
                <p className="mt-2 text-xs text-muted">{r.sub}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle sub="Geradas a partir dos seus números e do seu holerite">Recomendações de economia</CardTitle>
        <TipList tips={tips} />
      </Card>
    </div>
  );
}
