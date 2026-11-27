"use client";
import clsx from "clsx";
import { ChartLine, Info, PiggyBank, Plus, RefreshCw, Target } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { compute, incomeSplit, Tip } from "@/lib/finance";
import { money, pct, todayISO, uid } from "@/lib/format";
import {
  CLASSES,
  DEFAULT_REAL_RETURN,
  extrasHint,
  futureValue,
  monthlyIncomeFrom,
  PROFILE_LABEL,
  profileFromAnswers,
  QUIZ,
  RESERVE_COLOR,
  reserveTarget,
  suggestAllocation,
  yearsToGoal,
} from "@/lib/invest";
import type { Market } from "@/lib/market";
import { setInvest, update } from "@/lib/store";
import { MarketStatus, useMarket } from "@/lib/use-market";
import { AppData, Profile } from "@/lib/types";
import { ProjectionChart } from "./charts";
import { Badge, Button, Card, CardTitle, Empty, Field, Modal, MoneyInput, Input, ProgressBar, Select, TipList } from "./ui";

const DISCLAIMER = "Sugestões educativas geradas automaticamente a partir de regras e dados públicos. Não são recomendação de investimento profissional.";
const RETURNS = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];
const signed = (v: number) => `${v > 0 ? "+" : ""}${pct(v)}`;
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function InvestView({ data, month }: { data: AppData; month: string }) {
  const inv = data.invest ?? { invested: 0, reserve: 0 };
  const profile = inv.profile;
  const [quiz, setQuiz] = useState(false);
  const [aporte, setAporte] = useState(false);
  const { market, status, savedAt } = useMarket();
  const c = useMemo(() => compute(data, month), [data, month]);
  const { extra } = useMemo(() => incomeSplit(data, month), [data, month]);
  const target = useMemo(() => reserveTarget(data, month), [data, month]);
  const surplus = Math.max(0, c.balance);
  const investedThisMonth = c.byCat["Investimentos"] ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Investimentos</h1>
        <p className="text-sm text-muted">Destine a sobra do mês para construir uma renda complementar no futuro</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-medium text-muted">Sobra do mês</div>
            <div className={clsx("tabular text-2xl font-semibold tracking-tight", surplus > 0 ? "text-ok" : "text-muted")}>{money(surplus)}</div>
            {investedThisMonth > 0 && <div className="text-xs text-muted">Já investido este mês: {money(investedThisMonth)}</div>}
          </div>
          {profile && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Perfil {PROFILE_LABEL[profile]}</Badge>
              <Button size="sm" onClick={() => setQuiz(true)}><RefreshCw size={14} /> Refazer perfil</Button>
            </div>
          )}
        </div>
        <p className="mt-3 flex gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
          <Info size={14} className="mt-0.5 shrink-0" /> {DISCLAIMER}
        </p>
      </Card>

      {(!profile || quiz) && (
        <Quiz
          onDone={(p) => {
            setInvest({ profile: p });
            setQuiz(false);
          }}
          onCancel={profile ? () => setQuiz(false) : undefined}
        />
      )}

      <Panorama market={market} status={status} savedAt={savedAt} />

      {profile && !quiz && (
        <>
          <Allocation
            profile={profile}
            surplus={surplus}
            balance={c.balance}
            extra={extra}
            reserve={inv.reserve}
            target={target}
            market={market}
            onAporte={() => setAporte(true)}
          />
          <FutureIncome invested={inv.invested} reserve={inv.reserve} goal={inv.goalMonthly ?? 0} realReturn={inv.realReturn ?? DEFAULT_REAL_RETURN[profile]} defaultMonthly={surplus} />
        </>
      )}

      {aporte && <AporteModal month={month} defaultAmount={surplus} defaultDest={inv.reserve < target ? "reserva" : "investimentos"} onClose={() => setAporte(false)} />}
    </div>
  );
}

/* ---------------- Perfil ---------------- */
function Quiz({ onDone, onCancel }: { onDone: (p: Profile) => void; onCancel?: () => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(QUIZ.map(() => null));
  const done = answers.every((a) => a !== null);
  return (
    <Card>
      <CardTitle sub="3 perguntas rápidas para ajustar as sugestões ao seu jeito" right={onCancel && <Button size="sm" onClick={onCancel}>Cancelar</Button>}>
        Seu perfil de investidor
      </CardTitle>
      <div className="flex flex-col gap-5">
        {QUIZ.map((q, qi) => (
          <fieldset key={q.q}>
            <legend className="mb-2 text-sm font-medium">{qi + 1}. {q.q}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {q.options.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={answers[qi] === o.points}
                  onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? o.points : v)))}
                  className={clsx(
                    "cursor-pointer rounded-xl border px-3 py-2.5 text-left text-sm transition",
                    answers[qi] === o.points ? "border-brand bg-brand-soft font-medium text-brand" : "border-line bg-surface-2 hover:border-brand/50",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <Button variant="primary" disabled={!done} onClick={() => onDone(profileFromAnswers(answers as number[]))}>Ver minhas sugestões</Button>
      </div>
    </Card>
  );
}

/* ---------------- Panorama de mercado ---------------- */
function Panorama({ market, status, savedAt }: { market: Market | null; status: MarketStatus; savedAt: string | null }) {
  const v = (n: number | null | undefined, f: (x: number) => string) => (n == null ? "—" : f(n));
  const m = market;
  const tiles = [
    { label: "Selic", value: v(m?.selic, (x) => pct(x, 2)), sub: "ao ano" },
    { label: "IPCA 12 meses", value: v(m?.ipca12m, (x) => pct(x, 2)), sub: m?.ipcaExpect != null ? `esperado: ${pct(m.ipcaExpect)}` : "inflação" },
    { label: "Juro real", value: v(m?.realRate, (x) => pct(x)), sub: "Selic − inflação esperada" },
    { label: "Dólar", value: v(m?.dolar?.last, (x) => money(x)), sub: m?.dolar ? `${signed(m.dolar.change12m)} em 12 meses` : "" },
    { label: "Ibovespa", value: v(m?.indices.ibov?.change12m, signed), sub: "em 12 meses" },
    { label: "S&P 500", value: v(m?.indices.sp500?.change12m, signed), sub: "em 12 meses (em dólar)" },
  ];
  return (
    <Card>
      <CardTitle sub="Indicadores que ajustam as sugestões do mês">Panorama do mercado</CardTitle>
      {!m && status === "loading" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((t) => <div key={t.label} className="h-[74px] animate-pulse rounded-xl bg-surface-2" />)}
        </div>
      ) : !m ? (
        <p className="rounded-xl bg-surface-2 px-3 py-3 text-sm text-muted">Não foi possível carregar os dados de mercado agora. As sugestões abaixo seguem só o seu perfil.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tiles.map((t) => (
              <div key={t.label} className="min-w-0 rounded-xl border border-line bg-surface-2 p-3">
                <div className="text-xs text-muted">{t.label}</div>
                <div className="tabular mt-0.5 text-lg font-semibold tracking-tight [overflow-wrap:anywhere]">{t.value}</div>
                {t.sub && <div className="text-[11px] text-muted">{t.sub}</div>}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Fontes: Banco Central do Brasil e Yahoo Finance · atualizado em {when(m.updatedAt)}
            {status === "cached" && savedAt && <> · sem conexão, mostrando dados salvos em {when(savedAt)}</>}
          </p>
        </>
      )}
    </Card>
  );
}

/* ---------------- Divisão da sobra ---------------- */
function Allocation(p: {
  profile: Profile;
  surplus: number;
  balance: number;
  extra: number;
  reserve: number;
  target: number;
  market: Market | null;
  onAporte: () => void;
}) {
  const a = suggestAllocation({ surplus: p.surplus, profile: p.profile, reserve: p.reserve, reserveTarget: p.target, market: p.market });
  const missing = Math.max(0, p.target - p.reserve);
  const rows = [
    ...(a.toReserve > 0
      ? [{ id: "reserva", label: "Reserva de emergência", example: "Tesouro Selic ou CDB com liquidez diária", what: `Meta de ${money(p.target)} (6 meses de gastos) · faltam ${money(missing)}.`, color: RESERVE_COLOR, value: a.toReserve }]
      : []),
    ...CLASSES.map((c) => ({ ...c, value: a.byClass[c.id] })).filter((r) => r.value > 0),
  ];
  const tips: Tip[] = a.reasons.map((r) => ({ level: "info", title: "Ajuste do mês", text: r }));
  const hint = extrasHint(p.extra);
  if (hint) tips.push({ level: "good", title: "Renda extra", text: hint });
  if (p.market && a.reasons.length === 0) tips.push({ level: "info", title: "Sem ajustes este mês", text: "Os indicadores estão dentro do normal; a divisão segue os pesos do seu perfil." });

  return (
    <Card>
      <CardTitle sub="Sugestão para a sobra deste mês">Como dividir seus {money(p.surplus)}</CardTitle>
      {a.total === 0 ? (
        <Empty
          icon={<PiggyBank size={22} />}
          title="Sem sobra para investir este mês"
          text={p.balance < 0 ? "Neste mês as saídas passaram da renda. Veja no Relatório onde dá para economizar." : "Quando sobrar dinheiro no mês, a divisão sugerida aparece aqui."}
        />
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {rows.map((r) => (
              <div key={r.id}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} /> {r.label}
                  </span>
                  <span className="tabular font-semibold">{money(r.value)}</span>
                </div>
                <ProgressBar value={(r.value / a.total) * 100} color={r.color} />
                <p className="mt-1 text-xs leading-relaxed text-muted"><span className="font-medium text-fg">{r.example}</span> · {r.what}</p>
              </div>
            ))}
          </div>
          {tips.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold">Por que este mês</p>
              <TipList tips={tips} />
            </div>
          )}
          <Button variant="primary" className="mt-5 w-full sm:w-auto" onClick={p.onAporte}><Plus size={16} /> Registrar aporte</Button>
        </>
      )}
    </Card>
  );
}

/* ---------------- Registrar aporte ---------------- */
function AporteModal({ month, defaultAmount, defaultDest, onClose }: { month: string; defaultAmount: number; defaultDest: "reserva" | "investimentos"; onClose: () => void }) {
  const [amount, setAmount] = useState(Math.round(defaultAmount * 100) / 100);
  const today = todayISO();
  const defDate = today.slice(0, 7) === month ? today : `${month}-01`;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const date = String(f.get("date"));
    const dest = f.get("dest") === "reserva" ? "reserva" : "investimentos";
    if (amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    update((d) => {
      const cur = { invested: 0, reserve: 0, ...d.invest };
      const desc = dest === "reserva" ? "Aporte – Reserva de emergência" : "Aporte – Investimentos";
      return {
        ...d,
        expenses: [...d.expenses, { id: uid(), desc, amount, category: "Investimentos", date }],
        invest: dest === "reserva" ? { ...cur, reserve: cur.reserve + amount } : { ...cur, invested: cur.invested + amount },
      };
    });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Registrar aporte">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Valor"><MoneyInput value={amount} onChange={setAmount} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Destino">
            <Select name="dest" defaultValue={defaultDest}>
              <option value="reserva">Reserva de emergência</option>
              <option value="investimentos">Investimentos</option>
            </Select>
          </Field>
          <Field label="Data"><Input name="date" type="date" required defaultValue={defDate} /></Field>
        </div>
        <p className="text-xs text-muted">O aporte entra como gasto na categoria “Investimentos” e é somado ao seu saldo investido.</p>
        <Button variant="primary" type="submit" disabled={amount <= 0}>Salvar aporte</Button>
      </form>
    </Modal>
  );
}

/* ---------------- Renda futura ---------------- */
function FutureIncome({ invested, reserve, goal, realReturn, defaultMonthly }: { invested: number; reserve: number; goal: number; realReturn: number; defaultMonthly: number }) {
  const [monthly, setMonthly] = useState<number | null>(null);
  const pmt = monthly ?? Math.round(defaultMonthly * 100) / 100;
  const points = useMemo(() => Array.from({ length: 21 }, (_, y) => ({ year: y, value: futureValue(invested, pmt, realReturn, y) })), [invested, pmt, realReturn]);
  const years = goal > 0 ? yearsToGoal(invested, pmt, realReturn, goal) : null;

  return (
    <Card>
      <CardTitle sub="Quanto seus aportes podem render de renda extra no futuro">Renda futura</CardTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Já tenho investido"><MoneyInput value={invested} onChange={(v) => setInvest({ invested: v })} /></Field>
        <Field label="Reserva de emergência atual"><MoneyInput value={reserve} onChange={(v) => setInvest({ reserve: v })} /></Field>
        <Field label="Meta de renda extra por mês"><MoneyInput value={goal} onChange={(v) => setInvest({ goalMonthly: v > 0 ? v : undefined })} /></Field>
        <Field label="Aporte mensal" hint="Padrão: a sobra deste mês."><MoneyInput value={pmt} onChange={setMonthly} /></Field>
        <Field label="Rentabilidade real esperada">
          <Select value={String(realReturn)} onChange={(e) => setInvest({ realReturn: Number(e.target.value) })}>
            {RETURNS.map((r) => <option key={r} value={String(r)}>{pct(r)} ao ano acima da inflação</option>)}
          </Select>
        </Field>
      </div>

      <div className="mt-5"><ProjectionChart points={points} /></div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {[5, 10, 20].map((y) => (
          <div key={y} className="min-w-0 rounded-xl border border-line bg-surface-2 p-3">
            <div className="text-xs text-muted">Em {y} anos</div>
            <div className="tabular mt-0.5 text-[clamp(0.85rem,3.6vw,1.125rem)] font-semibold tracking-tight [overflow-wrap:anywhere]">{money(points[y].value)}</div>
            <div className="tabular text-[11px] text-muted [overflow-wrap:anywhere]">≈ {money(monthlyIncomeFrom(points[y].value))}/mês</div>
          </div>
        ))}
      </div>

      {goal > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-sm text-brand">
          {years !== null ? <ChartLine size={16} className="mt-0.5 shrink-0" /> : <Target size={16} className="mt-0.5 shrink-0" />}
          <span>
            {years === null
              ? "Com esse aporte a meta não é alcançada em 100 anos. Tente aumentar o aporte mensal."
              : years === 0
                ? <>Seu patrimônio atual já gera {money(goal)}/mês.</>
                : <>Você alcança <b>{money(goal)}/mês</b> de renda extra em ~<b>{String(years).replace(".", ",")} anos</b>.</>}
          </span>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">Valores em reais de hoje (já descontada a inflação). A renda mensal considera retirar 4% do patrimônio por ano, ritmo que tende a preservar o dinheiro no longo prazo.</p>
    </Card>
  );
}
