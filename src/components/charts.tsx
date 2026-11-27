"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORIES } from "@/lib/types";
import { Computed } from "@/lib/finance";
import { money, moneyCompact, pct } from "@/lib/format";

export const SURPLUS = "#94a3b8";

export interface Slice {
  name: string;
  value: number;
  color: string;
}

export function slicesOf(c: Computed): Slice[] {
  const s = CATEGORIES.filter((k) => c.byCat[k.name] > 0)
    .sort((a, b) => c.byCat[b.name] - c.byCat[a.name])
    .map((k) => ({ name: k.name, value: c.byCat[k.name], color: k.color }));
  if (c.income > c.outflow) s.push({ name: "Sobra", value: c.income - c.outflow, color: SURPLUS });
  return s;
}

export function Donut({ slices, total, centerTop, centerBottom }: { slices: Slice[]; total: number; centerTop: string; centerBottom: string }) {
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-52 w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={slices.length > 1 ? 2 : 0} stroke="none" cornerRadius={4} isAnimationActive animationDuration={700}>
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="card px-3 py-2 text-xs">
                    <b>{payload[0].name}</b>
                    <div className="tabular">{money(Number(payload[0].value))} · {pct((Number(payload[0].value) / total) * 100)}</div>
                  </div>
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="tabular text-2xl font-semibold tracking-tight">{centerTop}</div>
            <div className="text-xs text-muted">{centerBottom}</div>
          </div>
        </div>
      </div>
      <ul className="grid w-full flex-1 grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-1">
        {slices.map((s) => (
          <li key={s.name} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.name}
            </span>
            <span className="tabular text-muted">{pct((s.value / total) * 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HistoryChart({ data }: { data: { label: string; renda: number; saidas: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} width={68} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v) => moneyCompact(Number(v))} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="card px-3 py-2 text-xs">
                  <b className="capitalize">{label}</b>
                  {payload.map((p) => (
                    <div key={String(p.dataKey)} className="tabular flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
                      {p.name}: {money(Number(p.value))}
                    </div>
                  ))}
                </div>
              ) : null
            }
          />
          <Bar dataKey="renda" name="Renda" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={26} />
          <Bar dataKey="saidas" name="Saídas" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProjectionChart({ points }: { points: { year: number; value: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="proj-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={(v) => `${v}a`} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} width={68} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v) => moneyCompact(Number(v))} />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="card px-3 py-2 text-xs">
                  <b>Daqui a {label} {Number(label) === 1 ? "ano" : "anos"}</b>
                  <div className="tabular">Patrimônio: {money(Number(payload[0].value))}</div>
                </div>
              ) : null
            }
          />
          <Area type="monotone" dataKey="value" name="Patrimônio" stroke="#10b981" strokeWidth={2} fill="url(#proj-fill)" isAnimationActive animationDuration={700} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
