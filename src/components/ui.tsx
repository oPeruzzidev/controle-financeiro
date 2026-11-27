"use client";
import clsx from "clsx";
import { X } from "lucide-react";
import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { Tip } from "@/lib/finance";
import { Lightbulb, AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("card p-4 sm:p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ children, sub, right }: { children: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "soft";
  size?: "md" | "sm";
};
export function Button({ variant = "ghost", size = "md", className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "h-10 px-4 text-sm" : "h-8 px-3 text-[13px]",
        variant === "primary" && "bg-brand text-brand-fg shadow-sm hover:brightness-110 active:brightness-95",
        variant === "soft" && "bg-brand-soft text-brand hover:brightness-95",
        variant === "ghost" && "border border-line bg-surface-2 text-fg hover:border-brand/50",
        variant === "danger" && "border border-danger/40 text-danger hover:bg-danger/10",
        className,
      )}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-medium text-muted">
      {label}
      {children}
      {hint && <span className="text-xs font-normal">{hint}</span>}
    </label>
  );
}
const inputCls =
  "h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-base text-fg sm:text-[15px] outline-none transition placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/25";
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={clsx(inputCls, p.className)} />
);
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={clsx(inputCls, "cursor-pointer", p.className)} />
);

/** Campo de dinheiro com máscara (digita só números → 1.234,56). */
export function MoneyInput({
  value,
  onChange,
  ...rest
}: { value: number; onChange: (v: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const fmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>
      <input
        {...rest}
        inputMode="numeric"
        value={value ? fmt.format(value) : ""}
        placeholder="0,00"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
          onChange(digits ? parseInt(digits, 10) / 100 : 0);
        }}
        className={clsx(inputCls, "pl-9 tabular")}
      />
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input,select,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} className="card pop max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-b-2xl sm:pb-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 id={id} className="text-lg font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="cursor-pointer rounded-lg p-2 text-muted hover:bg-surface-2">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">{icon}</div>
      <p className="font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {action}
    </div>
  );
}

export function Badge({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {children}
    </span>
  );
}

export function Stat({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "pos" | "neg"; icon?: ReactNode }) {
  return (
    <Card className="fade-up">
      <div className="flex items-center justify-between gap-2 text-[13px] font-medium text-muted">
        <span className="min-w-0">{label}</span>
        {icon && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2">{icon}</span>}
      </div>
      <div className={clsx("tabular mt-2 text-[clamp(1.05rem,5vw,1.5rem)] font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-2xl", tone === "pos" && "text-ok", tone === "neg" && "text-danger")}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

export function ProgressBar({ value, color, track }: { value: number; color: string; track?: boolean }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setW(Math.max(0, Math.min(100, value))));
    return () => cancelAnimationFrame(t);
  }, [value]);
  return (
    <div className={clsx("h-2.5 overflow-hidden rounded-full", track !== false && "bg-surface-2")}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

const TIP_STYLE = {
  alert: { cls: "border-danger/40 bg-danger/10", icon: <ShieldAlert size={18} className="text-danger" /> },
  warn: { cls: "border-warn/40 bg-warn/10", icon: <AlertTriangle size={18} className="text-warn" /> },
  info: { cls: "border-line bg-surface-2", icon: <Info size={18} className="text-brand" /> },
  good: { cls: "border-ok/40 bg-ok/10", icon: <CheckCircle2 size={18} className="text-ok" /> },
} as const;

export function TipList({ tips }: { tips: Tip[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {tips.map((t, i) => (
        <div key={i} className={clsx("flex gap-3 rounded-xl border p-3.5", TIP_STYLE[t.level].cls)}>
          <span className="mt-0.5 shrink-0">{TIP_STYLE[t.level].icon}</span>
          <div>
            <p className="text-sm font-semibold">{t.title}</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{t.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
export { Lightbulb };
