export interface ParsedPayslip {
  gross: number;
  net: number;
  inss: number;
  irrf: number;
  fgts: number;
  deductions: number;
  month: string;
}

const MONEY = /\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)/g;
const parseBR = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
const moneysIn = (l: string) => (l.match(MONEY) ?? []).map(parseBR);
const pad = (n: number) => String(n).padStart(2, "0");

export function parsePayslip(text: string): ParsedPayslip {
  const out: ParsedPayslip = { gross: 0, net: 0, inss: 0, irrf: 0, fgts: 0, deductions: 0, month: "" };
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const flat = lines.join("\n");

  const firstAfter = (re: RegExp) => {
    const m = new RegExp(re.source + "[^\\d\\n]{0,40}?(\\d{1,3}(?:\\.\\d{3})*,\\d{2})(?!\\d)", "i").exec(flat);
    return m ? parseBR(m[m.length - 1]) : 0;
  };
  const lastOnLine = (re: RegExp, skip?: RegExp) => {
    for (const l of lines) {
      if (re.test(l) && !(skip && skip.test(l))) {
        const v = moneysIn(l);
        if (v.length) return v[v.length - 1];
      }
    }
    return 0;
  };

  out.gross = firstAfter(/(?:total\s+(?:de\s+)?(?:proventos|vencimentos)|sal[aá]rio\s+bruto|total\s+bruto)/);
  out.deductions = firstAfter(/total\s+(?:de\s+)?descontos/);
  out.net = firstAfter(/(?:l[ií]quido\s*(?:a\s+receber)?|valor\s+l[ií]quido)/);

  // Layout em colunas: rótulos numa linha, valores na linha seguinte.
  if (!out.gross || !out.net) {
    for (let i = 0; i < lines.length - 1; i++) {
      const L = lines[i].toLowerCase();
      if (/(proventos|vencimentos)/.test(L) && /descontos/.test(L) && /l[ií]quido/.test(L)) {
        const vals = moneysIn(lines[i + 1]);
        if (vals.length >= 3) {
          const pos: [string, number][] = [
            ["g", L.search(/(proventos|vencimentos)/)],
            ["d", L.search(/descontos/)],
            ["n", L.search(/l[ií]quido/)],
          ];
          pos.sort((a, b) => a[1] - b[1]).forEach(([k], idx) => {
            if (k === "g") out.gross = vals[idx];
            if (k === "d") out.deductions = vals[idx];
            if (k === "n") out.net = vals[idx];
          });
          break;
        }
      }
    }
  }
  out.inss = lastOnLine(/\binss\b|previd[eê]ncia\s+social/i, /base|sal[aá]rio\s+contrib|patronal/i);
  out.irrf = lastOnLine(/\birrf\b|i\.?\s?r\.?\s?r\.?\s?f|imposto\s+de\s+renda/i, /base|dedu[cç][aã]o/i);
  out.fgts = firstAfter(/(?:fgts\s+do\s+m[eê]s|valor\s+(?:do\s+)?fgts|fgts\s+dep[oó]sito|dep[oó]sito\s+fgts)/);
  if (!out.fgts) out.fgts = lastOnLine(/^\W*(?:\d+\W+)?fgts\b/i, /base|sal[aá]rio/i);

  if (!out.net && out.gross && out.deductions) out.net = out.gross - out.deductions;
  if (!out.gross && out.net && out.deductions) out.gross = out.net + out.deductions;

  const names = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const mn = /(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:\/|de|-)?\s*(\d{4})/i.exec(flat);
  if (mn) {
    const idx = names.indexOf(mn[1].toLowerCase().replace("ç", "c"));
    if (idx >= 0) out.month = `${mn[2]}-${pad(idx + 1)}`;
  }
  if (!out.month) {
    const mm =
      /(?:compet[eê]ncia|refer[eê]ncia|m[eê]s)[^\d]{0,15}(\d{2})\s*\/\s*(\d{4})/i.exec(flat) ??
      /\b(0[1-9]|1[0-2])\s*\/\s*(20\d{2})\b/.exec(flat);
    if (mm) out.month = `${mm[2]}-${mm[1]}`;
  }
  return out;
}

/* ---------- leitura de arquivo (PDF / imagem) no navegador ---------- */
/* eslint-disable @typescript-eslint/no-explicit-any */
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

function loadScript(src: string) {
  return new Promise<void>((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error("Falha ao carregar a biblioteca de leitura (verifique a conexão)."));
    document.head.appendChild(s);
  });
}

async function ocr(source: File | HTMLCanvasElement, onStatus: (s: string) => void) {
  const w = window as any;
  if (!w.Tesseract) await loadScript(TESS);
  onStatus("Reconhecendo texto da imagem (OCR)… pode levar alguns segundos.");
  const r = await w.Tesseract.recognize(source, "por");
  return r.data.text as string;
}

async function readPdf(file: File, onStatus: (s: string) => void) {
  const w = window as any;
  if (!w.pdfjsLib) await loadScript(PDFJS);
  w.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await w.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = "";
  for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const rows: Record<number, { x: number; s: string }[]> = {};
    content.items.forEach((it: any) => {
      const y = Math.round(it.transform[5] / 3);
      (rows[y] ??= []).push({ x: it.transform[4], s: it.str });
    });
    Object.keys(rows).map(Number).sort((a, b) => b - a).forEach((y) => {
      text += rows[y].sort((a, b) => a.x - b.x).map((i) => i.s).join(" ") + "\n";
    });
  }
  if (text.replace(/\s/g, "").length < 40) {
    // PDF escaneado (sem camada de texto): OCR da primeira página
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 2.2 });
    const cv = document.createElement("canvas");
    cv.width = vp.width;
    cv.height = vp.height;
    await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
    text = await ocr(cv, onStatus);
  }
  return text;
}

export async function readPayslipFile(file: File, onStatus: (s: string) => void) {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const text = isPdf ? await readPdf(file, onStatus) : await ocr(file, onStatus);
  return { text, parsed: parsePayslip(text) };
}
