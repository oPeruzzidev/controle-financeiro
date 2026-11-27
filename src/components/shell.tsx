"use client";
import clsx from "clsx";
import { CalendarClock, ChartLine, ChevronLeft, ChevronRight, Database, Ellipsis, FileText, LayoutDashboard, Moon, PieChart, Receipt, Sun, TrendingUp, Wallet } from "lucide-react";
import { ReactNode, useCallback, useState, useSyncExternalStore } from "react";
import { monthKeyOf, monthLabel, monthShortLabel, shiftMonth } from "@/lib/format";
import { useData, useHydrated } from "@/lib/store";
import { DataView } from "./data-view";
import { Dashboard } from "./dashboard";
import { InvestView } from "./invest-view";
import { Expenses, Fixed, Incomes } from "./lists";
import { PayslipView } from "./payslip-view";
import { InstallCard, useRegisterSW } from "./pwa";
import { Report } from "./report";
import { Modal } from "./ui";

const TABS = [
  { id: "resumo", label: "Resumo", icon: LayoutDashboard },
  { id: "rendas", label: "Rendas", icon: TrendingUp },
  { id: "fixas", label: "Contas fixas", icon: CalendarClock },
  { id: "gastos", label: "Gastos", icon: Receipt },
  { id: "investir", label: "Investir", icon: ChartLine },
  { id: "relatorio", label: "Relatório", icon: PieChart },
  { id: "holerite", label: "Holerite", icon: FileText },
  { id: "dados", label: "Dados", icon: Database },
] as const;
type TabId = (typeof TABS)[number]["id"];
const isTab = (s: string): s is TabId => TABS.some((t) => t.id === s);
/** Abas da barra inferior no celular; as demais ficam no menu "Mais". */
const MOBILE_MAIN: TabId[] = ["resumo", "gastos", "rendas", "investir"];

function MoreSheet({ open, onClose, go, tab, children }: { open: boolean; onClose: () => void; go: (t: string) => void; tab: TabId; children?: ReactNode }) {
  return (
    <Modal open={open} onClose={onClose} title="Mais opções">
      <div className="grid grid-cols-2 gap-3">
        {TABS.filter((t) => !MOBILE_MAIN.includes(t.id)).map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onClose();
              go(t.id);
            }}
            aria-current={tab === t.id ? "page" : undefined}
            className={clsx("flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-medium transition", tab === t.id ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface-2 text-fg hover:border-brand/50")}
          >
            <t.icon size={22} /> {t.label}
          </button>
        ))}
      </div>
      {children}
    </Modal>
  );
}

export function Shell() {
  const data = useData();
  const hydrated = useHydrated();
  const hash = useSyncExternalStore(
    (cb) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); },
    () => (typeof location !== "undefined" ? location.hash.slice(1) : ""),
    () => "",
  );
  const tab: TabId = isTab(hash) ? hash : "resumo";
  const [month, setMonth] = useState(() => monthKeyOf(new Date()));
  const [more, setMore] = useState(false);
  useRegisterSW();
  const dark = useSyncExternalStore(
    (cb) => {
      const mo = new MutationObserver(cb);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => mo.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );

  const go = useCallback((t: string) => {
    if (!isTab(t)) return;
    location.hash = t;
    window.scrollTo({ top: 0 });
  }, []);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("cf-theme", next ? "dark" : "light"); } catch { /* ignore */ }
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[250px_1fr]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface/70 p-4 backdrop-blur lg:flex">
        <div className="mb-6 flex items-center gap-3 px-2 pt-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-brand-fg shadow-sm"><Wallet size={20} /></span>
          <div className="leading-tight">
            <p className="font-semibold tracking-tight">Meu Financeiro</p>
            <p className="text-xs text-muted">Controle pessoal</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Principal">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => go(t.id)} aria-current={tab === t.id ? "page" : undefined}
              className={clsx("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", tab === t.id ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-fg")}>
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </nav>
        <p className="mt-auto px-2 text-[11px] leading-relaxed text-muted">Seus dados ficam só neste navegador. Faça backup em “Dados”.</p>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-fg"><Wallet size={18} /></span>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
            <button aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))} className="cursor-pointer rounded-lg p-2 text-muted hover:bg-surface-2"><ChevronLeft size={16} /></button>
            <span className="min-w-24 text-center text-sm font-semibold sm:min-w-36">
              <span className="sm:hidden">{monthShortLabel(month)}</span>
              <span className="hidden sm:inline">{monthLabel(month)}</span>
            </span>
            <button aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))} className="cursor-pointer rounded-lg p-2 text-muted hover:bg-surface-2"><ChevronRight size={16} /></button>
          </div>
          <button onClick={toggleTheme} aria-label="Alternar tema" className="cursor-pointer rounded-xl border border-line bg-surface p-2.5 text-muted hover:text-fg">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-6 lg:px-8 lg:pb-12">
          {!hydrated ? (
            <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
          ) : (
            <div key={tab + (tab === "resumo" ? month : "")} className="fade-up">
              {tab === "resumo" && <Dashboard data={data} month={month} go={go} />}
              {tab === "rendas" && <Incomes data={data} month={month} />}
              {tab === "fixas" && <Fixed data={data} month={month} />}
              {tab === "gastos" && <Expenses data={data} month={month} />}
              {tab === "investir" && <InvestView data={data} month={month} />}
              {tab === "relatorio" && <Report data={data} month={month} />}
              {tab === "holerite" && <PayslipView data={data} month={month} />}
              {tab === "dados" && <DataView data={data} />}
            </div>
          )}
        </main>
      </div>

      {/* Navegação inferior mobile */}
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {MOBILE_MAIN.map((id) => TABS.find((t) => t.id === id)!).map((t) => (
          <button key={t.id} onClick={() => go(t.id)} aria-current={tab === t.id ? "page" : undefined}
            className={clsx("flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-0.5 px-1 py-2.5 text-[11px] font-medium", tab === t.id ? "text-brand" : "text-muted")}>
            <t.icon size={20} /> {t.label}
          </button>
        ))}
        <button onClick={() => setMore(true)} aria-haspopup="dialog" aria-current={!MOBILE_MAIN.includes(tab) ? "page" : undefined}
          className={clsx("flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-0.5 px-1 py-2.5 text-[11px] font-medium", !MOBILE_MAIN.includes(tab) ? "text-brand" : "text-muted")}>
          <Ellipsis size={20} /> Mais
        </button>
      </nav>
      <MoreSheet open={more} onClose={() => setMore(false)} go={go} tab={tab}>
        <InstallCard />
      </MoreSheet>
    </div>
  );
}
