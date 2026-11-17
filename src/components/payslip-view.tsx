"use client";
import { FileUp, Loader2, ScanText, Trash2 } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { money, monthKeyOf, monthLabel, pct, uid } from "@/lib/format";
import { readPayslipFile } from "@/lib/payslip";
import { update } from "@/lib/store";
import { AppData } from "@/lib/types";
import { payslipTips } from "./report";
import { Button, Card, CardTitle, Empty, Field, Input, MoneyInput, ProgressBar, Stat, TipList } from "./ui";

export function PayslipView({ data, month }: { data: AppData; month: string }) {
  const [vals, setVals] = useState({ gross: 0, net: 0, inss: 0, irrf: 0, fgts: 0 });
  const [pmonth, setPmonth] = useState(month);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState("");
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const list = [...data.payslips].sort((a, b) => (a.month < b.month ? 1 : -1));
  const latest = list[0];

  async function handle(file?: File) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return setStatus("Arquivo muito grande (máx. 15 MB).");
    setBusy(true);
    setStatus(`Lendo “${file.name}”…`);
    try {
      const { text, parsed } = await readPayslipFile(file, setStatus);
      setVals({ gross: parsed.gross, net: parsed.net, inss: parsed.inss, irrf: parsed.irrf, fgts: parsed.fgts });
      setPmonth(parsed.month || month || monthKeyOf(new Date()));
      setRaw(text);
      const found = [parsed.gross, parsed.net, parsed.inss, parsed.irrf].filter(Boolean).length;
      setStatus(found >= 2 ? "Leitura concluída! Confira os valores e clique em “Salvar e analisar”." : "Não consegui identificar todos os valores. Complete os campos manualmente.");
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    } catch (e) {
      setStatus(`Erro ao ler o arquivo: ${e instanceof Error ? e.message : e}. Preencha os valores manualmente.`);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (vals.net <= 0 || !/^\d{4}-\d{2}$/.test(pmonth)) return;
    update((d) => ({ ...d, payslips: [...d.payslips.filter((p) => p.month !== pmonth), { id: uid(), month: pmonth, ...vals }] }));
    setStatus("Holerite salvo e analisado abaixo.");
  }
  function useAsIncome() {
    if (!latest) return;
    update((d) => ({ ...d, incomes: [...d.incomes, { id: uid(), desc: "Salário líquido (holerite)", amount: latest.net, type: "recorrente", month: latest.month }] }));
    setStatus("Líquido adicionado às rendas recorrentes.");
  }

  const set = (k: keyof typeof vals) => (v: number) => setVals((s) => ({ ...s, [k]: v }));
  const desc = latest ? Math.max(0, latest.gross - latest.net) : 0;
  const other = latest ? Math.max(0, desc - latest.inss - latest.irrf) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Holerite</h1>
        <p className="text-sm text-muted">Envie o contracheque para analisar seus descontos e montar o orçamento ideal</p>
      </div>

      <Card>
        <CardTitle sub="PDF ou imagem. A leitura acontece no seu navegador — o arquivo não é enviado a nenhum servidor.">Enviar holerite</CardTitle>
        <div
          onClick={() => !busy && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
          className={`grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${over ? "border-brand bg-brand-soft" : "border-line hover:border-brand/60"}`}
        >
          <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="flex flex-col items-center gap-2">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">{busy ? <Loader2 className="animate-spin" size={22} /> : <FileUp size={22} />}</span>
            <p className="font-medium">{busy ? "Processando…" : "Arraste o holerite aqui ou clique para escolher"}</p>
            <p className="text-xs text-muted">PDF, JPG ou PNG · até 15 MB</p>
          </div>
        </div>
        {status && <p aria-live="polite" className="mt-3 flex items-center gap-2 text-sm text-muted"><ScanText size={16} className="text-brand" />{status}</p>}
      </Card>

      <Card>
        <CardTitle sub="Confira e corrija se necessário antes de salvar">Valores do holerite</CardTitle>
        <form ref={formRef} onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Mês de referência"><Input type="month" required value={pmonth} onChange={(e) => setPmonth(e.target.value)} /></Field>
          <Field label="Total de proventos (bruto)"><MoneyInput value={vals.gross} onChange={set("gross")} /></Field>
          <Field label="Líquido a receber"><MoneyInput value={vals.net} onChange={set("net")} required /></Field>
          <Field label="INSS"><MoneyInput value={vals.inss} onChange={set("inss")} /></Field>
          <Field label="IRRF"><MoneyInput value={vals.irrf} onChange={set("irrf")} /></Field>
          <Field label="FGTS depositado"><MoneyInput value={vals.fgts} onChange={set("fgts")} /></Field>
          <div className="sm:col-span-2 lg:col-span-3"><Button variant="primary" type="submit" disabled={vals.net <= 0}>Salvar e analisar</Button></div>
        </form>
        {raw && (
          <details className="mt-4 text-sm text-muted">
            <summary className="cursor-pointer">Ver texto lido do arquivo</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-xs">{raw}</pre>
          </details>
        )}
      </Card>

      {!latest ? (
        <Card><Empty icon={<ScanText size={22} />} title="Nenhum holerite salvo" text="Envie um arquivo ou preencha os valores acima para ver a análise de descontos." /></Card>
      ) : (
        <>
          {latest.gross > 0 && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label={`Bruto · ${monthLabel(latest.month)}`} value={money(latest.gross)} />
              <Stat label="Líquido" value={money(latest.net)} sub={`${pct((latest.net / latest.gross) * 100)} do bruto`} tone="pos" />
              <Stat label="Total de descontos" value={money(desc)} sub={`${pct((desc / latest.gross) * 100)} do bruto`} tone={desc / latest.gross > 0.3 ? "neg" : undefined} />
              <Stat label="FGTS (empregador)" value={money(latest.fgts)} sub="não é descontado de você" />
            </div>
          )}
          <Card>
            <CardTitle sub="Para onde vai cada real do seu bruto">Composição do bruto</CardTitle>
            {latest.gross > 0 ? (
              <div className="flex flex-col gap-4">
                {[["INSS", latest.inss, "#3b82f6"], ["IRRF", latest.irrf, "#ef4444"], ["Outros descontos", other, "#64748b"], ["Líquido", latest.net, "#10b981"]]
                  .filter((x) => Number(x[1]) > 0)
                  .map(([n, v, color]) => (
                    <div key={String(n)}>
                      <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{n}</span><span className="tabular"><b>{pct((Number(v) / latest.gross) * 100)}</b> <span className="text-muted">· {money(Number(v))}</span></span></div>
                      <ProgressBar value={(Number(v) / latest.gross) * 100} color={String(color)} />
                    </div>
                  ))}
              </div>
            ) : <p className="text-sm text-muted">Informe o bruto para ver a composição.</p>}
          </Card>
          <Card>
            <CardTitle sub={`Com base no seu líquido de ${money(latest.net)}`}>Orçamento sugerido (50 / 30 / 20)</CardTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              {[["Necessidades · 50%", 0.5], ["Desejos · 30%", 0.3], ["Poupança · 20%", 0.2]].map(([t, f]) => (
                <div key={String(t)} className="rounded-xl border border-line bg-surface-2 p-4">
                  <div className="text-[13px] text-muted">{t}</div>
                  <div className="tabular mt-1 text-2xl font-semibold">{money(latest.net * Number(f))}</div>
                </div>
              ))}
            </div>
            {payslipTips(latest).length > 0 && <div className="mt-4"><TipList tips={payslipTips(latest)} /></div>}
            <div className="mt-4"><Button variant="soft" onClick={useAsIncome}>Usar líquido como renda recorrente a partir de {monthLabel(latest.month)}</Button></div>
          </Card>
          <Card>
            <CardTitle>Histórico de holerites</CardTitle>
            <ul>
              {list.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                  <div className="flex-1"><p className="font-medium">{monthLabel(p.month)}</p><p className="tabular text-xs text-muted">Bruto {money(p.gross)} · INSS {money(p.inss)} · IRRF {money(p.irrf)}</p></div>
                  <div className="tabular font-semibold">{money(p.net)}</div>
                  <button aria-label="Excluir" onClick={() => update((d) => ({ ...d, payslips: d.payslips.filter((x) => x.id !== p.id) }))} className="cursor-pointer rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
