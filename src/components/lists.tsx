"use client";
import { CalendarClock, Plus, Receipt, Trash2, TrendingUp } from "lucide-react";
import { FormEvent, ReactNode, useState } from "react";
import { expensesFor, fixedFor, incomesFor } from "@/lib/finance";
import { money, todayISO, uid } from "@/lib/format";
import { update } from "@/lib/store";
import { AppData, CAT, CATEGORIES } from "@/lib/types";
import { Badge, Button, Card, Empty, Field, Input, Modal, MoneyInput, Select } from "./ui";

function Header({ title, sub, total, onAdd, addLabel }: { title: string; sub: string; total: number; onAdd: () => void; addLabel: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted">{sub}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs text-muted">Total do mês</div>
          <div className="tabular text-xl font-semibold">{money(total)}</div>
        </div>
        <Button variant="primary" onClick={onAdd}>
          <Plus size={16} /> {addLabel}
        </Button>
      </div>
    </div>
  );
}

function Row({ left, right, onDelete }: { left: ReactNode; right: ReactNode; onDelete: () => void }) {
  return (
    <li className="group flex items-center gap-3 border-b border-line py-3 last:border-0">
      <div className="min-w-0 flex-1">{left}</div>
      <div className="tabular text-right font-semibold">{right}</div>
      <button onClick={onDelete} aria-label="Excluir" className="cursor-pointer rounded-lg p-2 text-muted transition hover:bg-danger/10 hover:text-danger">
        <Trash2 size={16} />
      </button>
    </li>
  );
}

function CatIcon({ name }: { name: string }) {
  const c = CAT[name];
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${c?.color}22` }}>
      {c?.emoji}
    </span>
  );
}

/* ---------------- Rendas ---------------- */
export function Incomes({ data, month }: { data: AppData; month: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const list = incomesFor(data, month);
  const total = list.reduce((s, x) => s + x.amount, 0);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (amount <= 0) return;
    update((d) => ({ ...d, incomes: [...d.incomes, { id: uid(), desc: String(f.get("desc")).trim().slice(0, 60), amount, type: f.get("type") === "unica" ? "unica" : "recorrente", month }] }));
    setOpen(false);
    setAmount(0);
  }
  function remove(id: string, recurring: boolean) {
    if (recurring && !confirm("Esta renda é recorrente e será removida de todos os meses. Continuar?")) return;
    update((d) => ({ ...d, incomes: d.incomes.filter((x) => x.id !== id) }));
  }

  return (
    <>
      <Header title="Rendas" sub="Salário e outros proventos" total={total} onAdd={() => setOpen(true)} addLabel="Nova renda" />
      <Card>
        {list.length === 0 ? (
          <Empty icon={<TrendingUp size={22} />} title="Nenhuma renda neste mês" text="Adicione seu salário, freelances, aluguéis recebidos e outros proventos." action={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> Adicionar renda</Button>} />
        ) : (
          <ul>
            {list.map((i) => (
              <Row
                key={i.id}
                onDelete={() => remove(i.id, i.type === "recorrente")}
                left={
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><TrendingUp size={18} /></span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{i.desc}</p>
                      <Badge>{i.type === "unica" ? "Única" : "Recorrente"}</Badge>
                    </div>
                  </div>
                }
                right={<span className="text-ok">+{money(i.amount)}</span>}
              />
            ))}
          </ul>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Nova renda">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Descrição"><Input name="desc" required maxLength={60} placeholder="Ex.: Salário, Freelance" /></Field>
          <Field label="Valor"><MoneyInput value={amount} onChange={setAmount} required /></Field>
          <Field label="Tipo" hint="Recorrentes valem deste mês em diante.">
            <Select name="type" defaultValue="recorrente">
              <option value="recorrente">Recorrente (todo mês)</option>
              <option value="unica">Única (só neste mês)</option>
            </Select>
          </Field>
          <Button variant="primary" type="submit" disabled={amount <= 0}>Salvar renda</Button>
        </form>
      </Modal>
    </>
  );
}

/* ---------------- Contas fixas ---------------- */
export function Fixed({ data, month }: { data: AppData; month: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const list = fixedFor(data, month).sort((a, b) => (a.dueDay || 99) - (b.dueDay || 99));
  const total = list.reduce((s, x) => s + x.amount, 0);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (amount <= 0) return;
    const cat = String(f.get("category"));
    update((d) => ({
      ...d,
      fixed: [...d.fixed, { id: uid(), desc: String(f.get("desc")).trim().slice(0, 60), amount, category: CAT[cat] ? cat : "Outros", dueDay: Math.min(31, Math.max(0, parseInt(String(f.get("dueDay")), 10) || 0)), from: month }],
    }));
    setOpen(false);
    setAmount(0);
  }
  return (
    <>
      <Header title="Contas fixas" sub="Despesas que se repetem todo mês" total={total} onAdd={() => setOpen(true)} addLabel="Nova conta" />
      <Card>
        {list.length === 0 ? (
          <Empty icon={<CalendarClock size={22} />} title="Nenhuma conta fixa" text="Cadastre aluguel, internet, escola, plano de saúde, financiamentos e outras contas mensais." action={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> Adicionar conta</Button>} />
        ) : (
          <ul>
            {list.map((f) => (
              <Row
                key={f.id}
                onDelete={() => confirm("Esta conta fixa será removida de todos os meses. Continuar?") && update((d) => ({ ...d, fixed: d.fixed.filter((x) => x.id !== f.id) }))}
                left={
                  <div className="flex items-center gap-3">
                    <CatIcon name={f.category} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{f.desc}</p>
                      <div className="flex gap-1.5">
                        <Badge color={CAT[f.category]?.color}>{f.category}</Badge>
                        {f.dueDay > 0 && <Badge>vence dia {f.dueDay}</Badge>}
                      </div>
                    </div>
                  </div>
                }
                right={money(f.amount)}
              />
            ))}
          </ul>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Nova conta fixa">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Descrição"><Input name="desc" required maxLength={60} placeholder="Ex.: Aluguel, Internet" /></Field>
          <Field label="Valor"><MoneyInput value={amount} onChange={setAmount} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Select name="category" defaultValue="Moradia">{CATEGORIES.map((c) => <option key={c.name}>{c.name}</option>)}</Select>
            </Field>
            <Field label="Dia do vencimento"><Input name="dueDay" type="number" min={1} max={31} placeholder="1–31" /></Field>
          </div>
          <Button variant="primary" type="submit" disabled={amount <= 0}>Salvar conta</Button>
        </form>
      </Modal>
    </>
  );
}

/* ---------------- Gastos ---------------- */
export function Expenses({ data, month }: { data: AppData; month: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [filter, setFilter] = useState("Todas");
  const all = expensesFor(data, month).sort((a, b) => (a.date < b.date ? 1 : -1));
  const list = filter === "Todas" ? all : all.filter((e) => e.category === filter);
  const total = all.reduce((s, x) => s + x.amount, 0);
  const today = todayISO();
  const defDate = today.slice(0, 7) === month ? today : `${month}-01`;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (amount <= 0) return;
    const cat = String(f.get("category"));
    const date = String(f.get("date"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    update((d) => ({ ...d, expenses: [...d.expenses, { id: uid(), desc: String(f.get("desc")).trim().slice(0, 60), amount, category: CAT[cat] ? cat : "Outros", date }] }));
    setOpen(false);
    setAmount(0);
  }
  return (
    <>
      <Header title="Gastos" sub="Despesas variáveis do dia a dia" total={total} onAdd={() => setOpen(true)} addLabel="Novo gasto" />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {["Todas", ...CATEGORIES.map((c) => c.name)].map((n) => (
          <button key={n} onClick={() => setFilter(n)} className={`cursor-pointer whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${filter === n ? "border-brand bg-brand text-brand-fg" : "border-line bg-surface text-muted hover:border-brand/50"}`}>
            {n}
          </button>
        ))}
      </div>
      <Card>
        {list.length === 0 ? (
          <Empty icon={<Receipt size={22} />} title="Nenhum gasto encontrado" text="Registre seus gastos para acompanhar para onde o dinheiro está indo." action={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> Registrar gasto</Button>} />
        ) : (
          <ul>
            {list.map((e) => (
              <Row
                key={e.id}
                onDelete={() => update((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== e.id) }))}
                left={
                  <div className="flex items-center gap-3">
                    <CatIcon name={e.category} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.desc}</p>
                      <div className="flex gap-1.5">
                        <Badge color={CAT[e.category]?.color}>{e.category}</Badge>
                        <Badge>{e.date.slice(8, 10)}/{e.date.slice(5, 7)}</Badge>
                      </div>
                    </div>
                  </div>
                }
                right={`-${money(e.amount)}`}
              />
            ))}
          </ul>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo gasto">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Descrição"><Input name="desc" required maxLength={60} placeholder="Ex.: Mercado, Uber" /></Field>
          <Field label="Valor"><MoneyInput value={amount} onChange={setAmount} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Select name="category" defaultValue="Alimentação">{CATEGORIES.map((c) => <option key={c.name}>{c.name}</option>)}</Select>
            </Field>
            <Field label="Data"><Input name="date" type="date" required defaultValue={defDate} /></Field>
          </div>
          <Button variant="primary" type="submit" disabled={amount <= 0}>Salvar gasto</Button>
        </form>
      </Modal>
    </>
  );
}
