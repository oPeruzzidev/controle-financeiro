"use client";
import { ArrowDownRight, ArrowUpRight, Lock, PiggyBank, ShoppingBag, Sparkles, Wallet } from "lucide-react";
import { useMemo } from "react";
import { buildTips, compute, potentialSavings } from "@/lib/finance";
import { money, pct, shiftMonth, shortMonth } from "@/lib/format";
import { AppData } from "@/lib/types";
import { Donut, HistoryChart, slicesOf } from "./charts";
import { Card, CardTitle, Empty, Stat, TipList, Button } from "./ui";

export function Dashboard({ data, month, go }: { data: AppData; month: string; go: (t: string) => void }) {
  const c = useMemo(() => compute(data, month), [data, month]);
  const tips = useMemo(() => buildTips(c), [c]);
  const history = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((m) => {
        const r = compute(data, m);
        return { label: shortMonth(m), renda: r.income, saidas: r.outflow };
      }),
    [data, month],
  );
  const slices = slicesOf(c);
  const denom = Math.max(c.income, c.outflow);
  const rate = c.income > 0 ? (c.poupado / c.income) * 100 : 0;
  const saving = potentialSavings(tips);

  if (!c.hasData) {
    return (
      <Card>
        <Empty
          icon={<Sparkles size={22} />}
          title="Vamos começar?"
          text="Cadastre sua renda, suas contas fixas e seus gastos. Em seguida você recebe o relatório de consumo da renda e recomendações de economia."
          action={
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => go("rendas")}>Adicionar renda</Button>
              <Button onClick={() => go("holerite")}>Enviar holerite</Button>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Renda do mês" value={money(c.income)} icon={<Wallet size={16} />} sub="salário + outros proventos" />
        <Stat label="Contas fixas" value={money(c.fixedTotal)} icon={<Lock size={16} />} sub={c.income ? `${pct((c.fixedTotal / c.income) * 100)} da renda` : undefined} />
        <Stat label="Gastos variáveis" value={money(c.varTotal)} icon={<ShoppingBag size={16} />} sub={c.income ? `${pct((c.varTotal / c.income) * 100)} da renda` : undefined} />
        <Stat
          label={c.balance < 0 ? "Déficit" : "Sobra do mês"}
          value={money(c.balance)}
          tone={c.balance < 0 ? "neg" : "pos"}
          icon={c.balance < 0 ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
          sub={c.income ? `${pct((c.balance / c.income) * 100)} da renda` : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle sub="Distribuição da renda por categoria">Para onde vai seu dinheiro</CardTitle>
          <Donut slices={slices} total={denom} centerTop={pct(c.income ? (c.outflow / c.income) * 100 : 100, 0)} centerBottom="da renda usada" />
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle sub="Meta recomendada: 20%">Taxa de poupança</CardTitle>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className={`tabular text-5xl font-semibold tracking-tight ${rate >= 20 ? "text-ok" : rate >= 10 ? "text-warn" : "text-danger"}`}>{pct(rate)}</div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, (rate / 20) * 100))}%`, background: rate >= 20 ? "var(--ok)" : rate >= 10 ? "var(--warn)" : "var(--danger)" }} />
            </div>
            <p className="text-center text-[13px] text-muted">
              {c.poupado >= 0 ? <>Você preserva <b className="text-fg">{money(c.poupado)}</b> neste mês.</> : <>Você gastou <b className="text-danger">{money(-c.poupado)}</b> a mais do que ganhou.</>}
            </p>
            {saving > 0 && (
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-[13px] text-brand">
                <PiggyBank size={16} /> Potencial de economia: <b>{money(saving)}/mês</b>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle sub="Renda × saídas nos últimos 6 meses">Evolução</CardTitle>
          <HistoryChart data={history} />
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle right={<Button size="sm" onClick={() => go("relatorio")}>Ver tudo</Button>}>Recomendações</CardTitle>
          <TipList tips={tips.slice(0, 3)} />
        </Card>
      </div>
    </div>
  );
}
