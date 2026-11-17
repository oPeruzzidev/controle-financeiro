"use client";
import { Download, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { monthKeyOf } from "@/lib/format";
import { replaceAll, sanitize } from "@/lib/store";
import { AppData, emptyData } from "@/lib/types";
import { Button, Card, CardTitle } from "./ui";

export function DataView({ data }: { data: AppData }) {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `controle-financeiro-${monthKeyOf(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importJson(file?: File) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = sanitize(JSON.parse(String(r.result)));
        if (!confirm("Importar vai substituir os dados atuais. Continuar?")) return;
        replaceAll(d);
        setMsg("Backup importado com sucesso.");
      } catch {
        setMsg("Arquivo inválido.");
      }
    };
    r.readAsText(file);
  }
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Seus dados</h1>
        <p className="text-sm text-muted">Backup, migração entre aparelhos e privacidade</p>
      </div>
      <Card>
        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><ShieldCheck size={20} /></span>
          <div className="text-sm">
            <p className="font-semibold">Privacidade total</p>
            <p className="mt-1 text-muted">Tudo fica salvo apenas neste navegador. Nada é enviado a servidores — nem o seu holerite. Para usar em outro aparelho (ou não perder nada se limpar o navegador), exporte um backup e importe no destino.</p>
          </div>
        </div>
      </Card>
      <Card>
        <CardTitle sub={`${data.incomes.length} rendas · ${data.fixed.length} contas fixas · ${data.expenses.length} gastos · ${data.payslips.length} holerites`}>Backup</CardTitle>
        <div className="flex flex-wrap gap-3">
          <Button onClick={exportJson}><Download size={16} /> Exportar backup</Button>
          <Button onClick={() => ref.current?.click()}><Upload size={16} /> Importar backup</Button>
          <input ref={ref} hidden type="file" accept="application/json" onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = ""; }} />
          <Button variant="danger" onClick={() => confirm("Apagar TODOS os dados deste navegador? Isso não pode ser desfeito.") && (replaceAll(emptyData()), setMsg("Dados apagados."))}>
            <Trash2 size={16} /> Apagar tudo
          </Button>
        </div>
        {msg && <p aria-live="polite" className="mt-3 text-sm text-muted">{msg}</p>}
      </Card>
    </div>
  );
}
