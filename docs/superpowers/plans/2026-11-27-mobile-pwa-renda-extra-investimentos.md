# App no celular, renda extra e investimentos: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o app instalável no celular, corrigir o layout mobile, separar renda fixa de renda extra e criar a aba Investimentos, que divide a sobra do mês com regras e dados reais de mercado.

**Architecture:**
- Continua sendo um app só de cliente, com os dados em `localStorage`.
- A única novidade no servidor é `GET /api/mercado`, um route handler que busca dados públicos (Banco Central + Yahoo) com cache de `fetch` de 24 h.
- Toda a lógica nova fica em módulos puros e testados (`lib/market.ts`, `lib/invest.ts`, `lib/finance.ts`); os componentes só exibem.
- PWA com manifest do App Router, ícones PNG gerados por script (`next/og`) e um service worker escrito à mão em `public/sw.js`.

**Tech Stack:** Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript, Tailwind 4, Recharts 3, lucide-react 1.74, Vitest (novo).

**Spec:** `docs/superpowers/specs/2026-11-27-mobile-pwa-renda-extra-investimentos-design.md`

## Global Constraints

- **Nunca abrir navegador** (Playwright, Chrome, emulação). Verificar com `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `next start` + `curl`, e lendo PNGs com a ferramenta Read.
- Antes de escrever código de uma área do Next, ler o guia correspondente em `node_modules/next/dist/docs/` (AGENTS.md).
- **Sem commit/push** sem pedido do usuário. O repositório ainda não tem commits. Os passos "Checkpoint" só rodam os testes; commit apenas se o usuário autorizar.
- Os dados continuam na chave `controle-financeiro:v2`. Campos novos são opcionais e backups antigos precisam carregar sem perda.
- Nenhum dado pessoal vai para o servidor. `/api/mercado` não recebe parâmetros.
- Os valores de `Income.type` continuam `"recorrente" | "unica"`. Na interface: "Fixa (todo mês)" / "Extra (só neste mês)".
- O texto de aviso em Investimentos é exatamente: "Sugestões educativas geradas automaticamente a partir de regras e dados públicos. Não são recomendação de investimento profissional."
- Textos da interface em pt-BR; valores com `money()`/`pct()` de `lib/format.ts`.

## Review Focus

1. **Backup antigo / localStorage sem campos novos** (renda `unica` sem `date`/`source`, sem `invest`): carrega igual, e o extra aparece com data dia 1 e sem origem. Testes nas Tasks 1 e 3.
2. **Fontes de mercado fora do ar ou lentas** (Yahoo bloqueado, BCB com timeout): a rota responde 200 com `null` e `errors[]`, a tela mostra "—" e os ajustes correspondentes são pulados. Testes nas Tasks 4 e 5.
3. **Mês com déficit ou sobra zero**: nenhuma divisão sugerida, todos os valores 0 e mensagem "Sem sobra para investir este mês". Teste na Task 5.
4. **Reserva já cheia ou meta 0** (sem histórico de gastos): nada vai para a reserva. Teste na Task 5.
5. **Valores muito altos em telas de 320–360 px** (R$ 1.234.567,89 num cartão de 2 colunas): quebram em vez de estourar. Coberto pelo checklist da Task 2 (não dá para testar sem navegador; confirmação final do usuário).

---

### Task 1: Vitest + modelo de dados (renda extra e investimentos)

**Files:**
- Modify: `package.json` (devDependency `vitest`; scripts `"test": "vitest run"`, `"test:watch": "vitest"`)
- Create: `vitest.config.mts`
- Modify: `src/lib/types.ts`, `src/lib/store.ts` (`sanitize`, `setInvest`), `src/lib/finance.ts`, `src/lib/format.ts`
- Test: `src/lib/__tests__/store.test.ts`, `src/lib/__tests__/finance.test.ts`, `src/lib/__tests__/format.test.ts`

**Interfaces:**
- Produces (em `types.ts`):
  - `Income` ganha `date?: string` (YYYY-MM-DD) e `source?: string`.
  - `INCOME_SOURCES = ["Freelance", "Hora extra", "Comissão", "Venda", "Aluguel", "Bônus", "Outros"] as const`.
  - `type Profile = "conservador" | "moderado" | "arrojado"`.
  - `interface InvestSettings { profile?: Profile; invested: number; reserve: number; goalMonthly?: number; realReturn?: number }`.
  - `AppData.invest?: InvestSettings`.
- Produces (em `finance.ts`):
  - `incomeSplit(d: AppData, m: string): { fixed: number; extra: number }`
  - `extraAverage(d: AppData, m: string, months = 6): number`: soma dos extras de `m-5..m` dividida por `months`.
- Produces (em `store.ts`): `setInvest(patch: Partial<InvestSettings>): void`. Faz merge sobre `{ invested: 0, reserve: 0, ...d.invest }`.
- Produces (em `format.ts`): `monthShortLabel(key: string): string`, por exemplo `"2026-11"` → `"Nov 2026"`.

- [ ] **Step 1: Instalar o Vitest e criar a config**

`npm i -D vitest`. Criar `vitest.config.mts` com `test.environment: "node"`, `test.include: ["src/**/*.test.ts"]` e `resolve.alias: { "@": <abs>/src }`.

- [ ] **Step 2: Escrever os testes que falham**

`store.test.ts`:
- `sanitize mantém backup antigo`: `{ incomes: [{ id: "a", desc: "Freela", amount: 500, type: "unica", month: "2026-10" }], fixed: [], expenses: [], payslips: [] }` → a renda sai idêntica, sem `date`/`source`, e `invest` fica `undefined`.
- `sanitize aceita campos novos válidos`: renda `unica` com `date: "2026-10-15"`, `source: "Freelance"` → mantém os dois.
- `sanitize descarta campos novos inválidos`:
  - `date: "2026-09-15"` com `month: "2026-10"` (mês diferente) → sem `date`;
  - `source: "Hack"` → sem `source`.
- `sanitize normaliza invest`:
  - `{ profile: "x", invested: "-5", reserve: 1000, goalMonthly: 0, realReturn: 50 }` → `{ invested: 0, reserve: 1000 }`. Sem `profile`, `goalMonthly` ou `realReturn`, porque `realReturn` válido fica entre 0 e 20.
  - `invest: "lixo"` → `undefined`.

`finance.test.ts` (dados: fixa 5000 recorrente desde `2026-01`; extras 600 em `2026-11`, 300 em `2026-09`, 900 em `2026-04`):
- `incomeSplit(d, "2026-11")` → `{ fixed: 5000, extra: 600 }`.
- `extraAverage(d, "2026-11")` → `150`, porque (600 + 300) / 6; o extra de abril fica fora da janela.
- `compute(d, "2026-11").income` → `5600`, sem regressão.

`format.test.ts`: `monthShortLabel("2026-11")` → `"Nov 2026"` e `monthShortLabel("2026-03")` → `"Mar 2026"`.

- [ ] **Step 3: Rodar e confirmar a falha**

Run: `npm test`
Expected: FAIL (funções inexistentes / campos removidos pelo `sanitize` atual).

- [ ] **Step 4: Implementar os tipos, o `sanitize`, `setInvest`, `incomeSplit`, `extraAverage` e `monthShortLabel`**

O `sanitize` só copia `date` se casar com `DRE` e `date.slice(0, 7) === month`, e só copia `source` se estiver em `INCOME_SOURCES`. Para `invest`, aplica as regras do teste com `num()`, limitando `invested` e `reserve` a ≥ 0.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test` → PASS. `npx tsc --noEmit` → sem erros.

- [ ] **Step 6: Checkpoint**: `npm run lint` sem erros.

---

### Task 2: Correções de layout no celular

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui.tsx`, `src/components/lists.tsx` (`Header`, `Row`), `src/components/report.tsx`, `src/components/charts.tsx` (`Donut`, legenda), `src/components/shell.tsx` (cabeçalho, `dvh`, padding do `main`), `src/components/dashboard.tsx` e `payslip-view.tsx` (gap dos grids de `Stat`)

**Interfaces:**
- Consumes: `monthShortLabel` (Task 1).
- Produces: `Card` com padding padrão `p-4 sm:p-5`. Chamadores que precisarem de outro padding sobrescrevem via `className`.

Mudanças (os números seguem a tabela 5.2 do spec):

| # | Mudança exata |
|---|---|
| 1 | `inputCls`: `text-[15px]` → `text-base sm:text-[15px]` |
| 2 | `Card`: `p-5` → `p-4 sm:p-5`. Valor do `Stat`: `text-2xl` → `text-[clamp(1.05rem,5vw,1.5rem)] sm:text-2xl [overflow-wrap:anywhere]`. Rótulo do `Stat`: `min-w-0`. Grids de `Stat`: `gap-3 sm:gap-4` |
| 4 | Seletor de mês no cabeçalho: `<span className="sm:hidden">{monthShortLabel(month)}</span><span className="hidden sm:inline">{monthLabel(month)}</span>`, `min-w-24 sm:min-w-36`. Header com `pt-[calc(0.75rem+env(safe-area-inset-top))]` |
| 5 | Selos do `Row`: `flex flex-wrap gap-1.5`. Valor e botão de excluir: `shrink-0` |
| 6 | `Modal`: `max-h-[92dvh] overscroll-contain` e, no celular, `pb-[calc(1.25rem+env(safe-area-inset-bottom))]` (`sm:pb-5`) |
| 7 | `shell.tsx`: `min-h-screen` → `min-h-dvh`, `h-screen` → `h-dvh`. `main`: `pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-12` |
| 8 | `Field` (label): `min-w-0`. `globals.css`: `input[type="date"] { -webkit-appearance: none; appearance: none; min-width: 0; }` e `input[type="date"]::-webkit-date-and-time-value { text-align: left; }` |
| 9 | `globals.css`: remover `background-attachment: fixed` de `.dark body`; mover os gradientes para `.dark body::before { content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; background: <os dois radial-gradient>; }`; `.dark body` fica só com `background: var(--bg)` |
| 10 | Linhas do Relatório e da legenda do `Donut`: container `flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5`, nome com `min-w-0` |
| 11 | `globals.css` `html`: `-webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%;` |
| 12 | `lists.tsx` `Header`: o bloco total + botão vira `flex w-full items-center justify-between gap-4 sm:w-auto` |
| — | `layout.tsx` `viewport`: acrescentar `viewportFit: "cover"` |

- [ ] **Step 1: Aplicar as mudanças da tabela**
- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: os três sem erros.
Run: `grep -rn "h-screen\|min-h-screen\|92vh\|background-attachment" src` → nenhum resultado.

- [ ] **Step 3: Checklist de revisão de código** (sem navegador): para cada linha da tabela, abrir o arquivo e confirmar a classe aplicada. Anotar no relatório da task.

---

### Task 3: Renda extra na interface

**Files:**
- Modify: `src/components/lists.tsx` (`Incomes`), `src/components/dashboard.tsx` (cartão "Renda do mês")
- Test: `src/lib/__tests__/finance.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `incomeSplit`, `extraAverage`, `INCOME_SOURCES`, campos `date`/`source` (Task 1).
- Produces (em `finance.ts`): `extraDate(i: Income): string`, que devolve `i.date ?? \`${i.month}-01\``.

- [ ] **Step 1: Teste que falha**: `extraDate({ ..., type: "unica", month: "2026-10" })` → `"2026-10-01"`; com `date: "2026-10-15"` → `"2026-10-15"`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implementar `extraDate` e a interface**
  - `Incomes` com duas seções em `Card`s separados:
    - "Renda fixa": rendas `recorrente`, com o total.
    - "Extras do mês": rendas `unica`, ordenadas por `extraDate` decrescente. Cada linha mostra os selos de origem (se houver) e `DD/MM`, e o total.
  - Rodapé da seção de extras: "Média de extras (6 meses): {money(extraAverage)}".
  - Botões do cabeçalho: principal "+ Renda extra", secundário "+ Renda fixa". Os dois abrem o mesmo modal com o tipo já escolhido.
  - Modal:
    - Campo "Tipo" com as opções "Fixa (todo mês)" / "Extra (só neste mês)".
    - Quando for extra, mostra "Data" (padrão: hoje, se `month` for o mês atual; senão `${month}-01`; `min`/`max` limitados ao mês) e "Origem" (`Select` com `INCOME_SOURCES`, padrão "Freelance").
    - Ao salvar um extra, grava `date` e `source`.
  - Os empty states continuam como hoje, adaptados a cada seção.
  - `Dashboard`: `sub` do `Stat` "Renda do mês" = `fixa {money(fixed)} + extras {money(extra)}` quando `extra > 0`; senão mantém "salário + outros proventos".
- [ ] **Step 4:** `npm test` → PASS; `npx tsc --noEmit && npm run lint` sem erros.
- [ ] **Step 5: Checkpoint**: `npm run build` sem erros.

---

### Task 4: Dados de mercado: `lib/market.ts` + `GET /api/mercado`

Ler antes: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` e `02-guides/caching-without-cache-components.md`. O projeto **não** usa `cacheComponents`.

**Files:**
- Create: `src/lib/market.ts` (sem `"use client"`, sem React)
- Create: `src/app/api/mercado/route.ts`
- Create: `src/lib/use-market.ts` (`"use client"`)
- Create: `src/lib/__tests__/fixtures/yahoo-bvsp.json` (resposta real capturada)
- Test: `src/lib/__tests__/market.test.ts`

**Interfaces:**
- Produces (em `market.ts`):
  ```ts
  export interface IndexQuote { last: number; change12m: number; fromHigh: number } // % com sinal
  export interface Market {
    updatedAt: string; // ISO
    selic: number | null; cdi: number | null; ipca12m: number | null;
    ipcaExpect: number | null; realRate: number | null;
    dolar: { last: number; change12m: number } | null;
    indices: Record<"ibov" | "sp500" | "bova11" | "ivvb11" | "xfix11", IndexQuote | null>;
    errors: string[];
  }
  export function parseSgsLast(json: unknown): number | null
  export function parseSgsChange(json: unknown): { last: number; change12m: number } | null
  export function parseFocus12m(json: unknown): number | null
  export function parseYahooChart(json: unknown): IndexQuote | null
  export function realRate(selicPct: number, ipcaPct: number): number // ((1+s)/(1+i)-1)*100
  export function fetchMarket(fetcher?: typeof fetch, now?: Date): Promise<Market>
  ```
- Produces (em `use-market.ts`): `useMarket(): { market: Market | null; status: "loading" | "ok" | "cached" | "error"; savedAt: string | null }`.

URLs (`fetchMarket`, todas em paralelo com `Promise.allSettled`; cada chamada com `{ next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0" } }`):
- SGS `https://api.bcb.gov.br/dados/serie/bcdata.sgs.{n}/dados/ultimos/1?formato=json` para `432` (selic), `4389` (cdi), `13522` (ipca12m).
- Dólar: SGS `1` com `/dados?formato=json&dataInicial={dd/MM/yyyy de now−365d}&dataFinal={dd/MM/yyyy de now}`.
- Focus: `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoInflacao12Meses?$top=1&$filter=Indicador eq 'IPCA' and Suavizada eq 'S' and baseCalculo eq 0&$orderby=Data desc&$format=json&$select=Mediana` (com URL-encode).
- Yahoo: `https://query1.finance.yahoo.com/v8/finance/chart/{símbolo}?range=1y&interval=1mo` para `^BVSP`, `^GSPC`, `BOVA11.SA`, `IVVB11.SA`, `XFIX11.SA`.
- `ipcaExpect` = Focus ou, se faltar, `ipca12m`. `realRate` = `realRate(selic, ipcaExpect)` quando os dois existirem.
- Cada fonte que falhar (exceção, `!res.ok` ou parser retornando `null`) entra em `errors` com o nome da chave (`"selic"`, `"cdi"`, `"ipca12m"`, `"ipcaExpect"`, `"dolar"`, `"ibov"`, …) e o valor fica `null`. `fetchMarket` nunca lança exceção.

- [ ] **Step 1: Capturar a fixture real**

Run: `curl -s -A "Mozilla/5.0" "https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?range=1y&interval=1mo" > src/lib/__tests__/fixtures/yahoo-bvsp.json`
Expected: arquivo com `"chart":{"result":[`.

- [ ] **Step 2: Escrever os testes que falham** (`market.test.ts`)
- `parseSgsLast([{ data: "25/11/2026", valor: "13.65" }])` → `13.65`; `parseSgsLast([])` → `null`; `parseSgsLast({ erro: 1 })` → `null`.
- `parseSgsChange([{ valor: "5.00" }, { valor: "5.50" }, { valor: "5.75" }])` → `{ last: 5.75, change12m: 15 }` (`toBeCloseTo`).
- `parseFocus12m({ value: [{ Mediana: 5.4092 }] })` → `5.4092`; `{ value: [] }` → `null`.
- `parseYahooChart({ chart: { result: [{ indicators: { quote: [{ close: [100, null, 120, 90] }] } }] } })` → `{ last: 90, change12m: -10, fromHigh: -25 }`.
- `parseYahooChart(fixture yahoo-bvsp.json)` → `last > 0`, e `fromHigh <= 0`.
- `parseYahooChart({ chart: { result: null, error: {} } })` → `null`.
- `realRate(13.75, 5.4092)` → `≈ 7.91` (`toBeCloseTo(7.91, 2)`).
- `fetchMarket` com um `fetcher` falso que responde por URL:
  - SGS 432 → `[{valor:"13.75"}]`;
  - Focus → `{value:[{Mediana:5}]}`;
  - todo Yahoo → lança `Error("blocked")`;
  - os demais → `res.ok=false`.
  - Esperado: `selic === 13.75`, `ipcaExpect === 5`, `realRate ≈ 8.33`, `indices.ibov === null`, `errors` contém `"ibov"`, `"cdi"` e `"dolar"`, e a promise resolve (não rejeita).
- `fetchMarket` com um fetcher que sempre lança erro → todos os campos `null`, `errors.length === 10`.

- [ ] **Step 3:** `npm test` → FAIL.
- [ ] **Step 4: Implementar `market.ts`**

`parseYahooChart`: usar só `indicators.quote[0].close` sem nulos (nunca `meta`). `last` = último, `change12m` = (último / primeiro − 1) × 100, `fromHigh` = (último / máximo − 1) × 100. Com menos de 2 fechamentos, retorna `null`.

- [ ] **Step 5: Implementar a rota**

`route.ts`: `export async function GET() { const m = await fetchMarket(); return Response.json(m, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }); }`. Sem `dynamic = "force-dynamic"`, porque isso anularia o cache dos `fetch`.

- [ ] **Step 6: Implementar `useMarket`**

`fetch("/api/mercado")`. Em caso de sucesso, grava `{ savedAt, market }` em `localStorage["cf-market"]` e retorna `status "ok"`. Em caso de falha, lê o cache (`"cached"`) ou retorna `"error"`. Em `"loading"`, já mostra o cache, se houver.

- [ ] **Step 7: Verificar**

Run: `npm test` → PASS.
Run: `npm run build`, depois `npx next start -p 3100` em segundo plano e `curl -s localhost:3100/api/mercado`.
Expected: JSON com `selic` numérico e `errors` como array. Encerrar o servidor.

---

### Task 5: Motor de investimentos `lib/invest.ts`

**Files:**
- Create: `src/lib/invest.ts`
- Test: `src/lib/__tests__/invest.test.ts`

**Interfaces:**
- Consumes: `Market` (Task 4), `Profile`, `AppData` (Task 1), `compute`/`shiftMonth` (existentes).
- Produces:
  ```ts
  export type AssetClass = "pos" | "ipca" | "fii" | "acoes" | "exterior";
  export type Weights = Record<AssetClass, number>; // soma 100
  export const CLASSES: { id: AssetClass; label: string; example: string; what: string; color: string }[];
  export const BASE_WEIGHTS: Record<Profile, Weights>;
  export const RESERVE_SHARE: Record<Profile, number>;      // 1 | 0.7 | 0.5
  export const DEFAULT_REAL_RETURN: Record<Profile, number>; // 3.5 | 4.5 | 5.5
  export const QUIZ: { q: string; options: { label: string; points: 0 | 1 | 2 }[] }[]; // 3 perguntas
  export function profileFromAnswers(points: number[]): Profile;
  export function reserveTarget(d: AppData, m: string): number;
  export function applyTilts(base: Weights, mk: Market | null): { weights: Weights; reasons: string[] };
  export interface Allocation { total: number; toReserve: number; byClass: Record<AssetClass, number>; weights: Weights; reasons: string[] }
  export function suggestAllocation(i: { surplus: number; profile: Profile; reserve: number; reserveTarget: number; market: Market | null }): Allocation;
  export function futureValue(invested: number, monthly: number, realReturnPct: number, years: number): number;
  export function monthlyIncomeFrom(patrimony: number): number; // patrimony * 0.04 / 12
  export function yearsToGoal(invested: number, monthly: number, realReturnPct: number, goalMonthly: number): number | null; // 1 casa decimal; null se > 100 anos
  export function extrasHint(extra: number): string | null;   // null se extra <= 0
  ```

Valores fixados pelo spec:
- `BASE_WEIGHTS`:
  - conservador `{pos:40, ipca:35, fii:15, acoes:5, exterior:5}`;
  - moderado `{pos:20, ipca:30, fii:20, acoes:15, exterior:15}`;
  - arrojado `{pos:10, ipca:20, fii:20, acoes:25, exterior:25}`.
- `CLASSES` (rótulo / exemplo):
  - pos "Renda fixa pós" / "Tesouro Selic, CDB com liquidez diária";
  - ipca "Renda fixa inflação" / "Tesouro IPCA+";
  - fii "Fundos imobiliários" / "FIIs ou ETF XFIX11";
  - acoes "Ações Brasil" / "ETF BOVA11 ou ações pagadoras de dividendos";
  - exterior "Exterior" / "ETF IVVB11 (S&P 500)".
- `applyTilts`, nesta ordem, cada um movendo `min(5, peso da origem)` pontos e acrescentando 1 frase:
  1. `realRate > 6`: acoes → ipca.
  2. `realRate < 4`: pos → acoes.
  3. `ibov.fromHigh <= -15`: pos → acoes.
  4. `dolar.change12m > 15`: exterior → ipca.
  5. `dolar.change12m < -10`: pos → exterior.
  6. `xfix11.fromHigh <= -10`: pos → fii.
  - Dado `null` → regra pulada.
- `reserveTarget`: 6 × média de `compute(d, mês).consumo` para `m-2..m`, considerando só os meses com `consumo > 0`. Se nenhum tiver, usa `compute(d, m).consumo`.
- `suggestAllocation`:
  - Se `surplus <= 0`, tudo 0, com `weights`/`reasons` de `applyTilts`.
  - Senão:
    1. `missing = max(0, reserveTarget - reserve)`;
    2. `toReserve = floor10(min(missing, surplus × RESERVE_SHARE))`;
    3. `rest = surplus - toReserve`;
    4. cada classe ≠ pos recebe `floor10(rest × w / 100)`;
    5. `pos = rest − soma das outras`, para que o total feche exato.
  - `floor10(x) = Math.floor(x / 10) * 10`.
- `futureValue`: taxa mensal `r = (1 + R/100)^(1/12) − 1`, `n = anos × 12`, `FV = P(1+r)^n + PMT((1+r)^n − 1)/r`. Se `R = 0`, `FV = P + PMT·n`.
- `yearsToGoal`: primeiro mês `n ≤ 1200` em que `monthlyIncomeFrom(FV) ≥ goalMonthly`, retornando `round(n / 12, 1)`.
- `profileFromAnswers`: soma 0–2 → conservador, 3–4 → moderado, 5–6 → arrojado.
- `QUIZ`: (1) "Quando você vai precisar desse dinheiro?" — menos de 2 anos (0) / 2 a 5 anos (1) / mais de 5 anos (2). (2) "Se seus investimentos caíssem 20% em um mês, você…" — resgataria tudo (0) / esperaria recuperar (1) / aproveitaria para investir mais (2). (3) "Qual sua experiência com investimentos?" — só poupança (0) / renda fixa (1) / já investi em ações ou FIIs (2).
- `extrasHint(600)` → frase que menciona `money(480)` (80% do extra).

- [ ] **Step 1: Escrever os testes que falham** (`invest.test.ts`)
- `BASE_WEIGHTS`: cada perfil soma 100.
- `profileFromAnswers([0,1,1])` → `"conservador"`; `[1,1,1]` → `"moderado"`; `[2,2,1]` → `"arrojado"`.
- `applyTilts(BASE_WEIGHTS.moderado, null)` → pesos iguais, `reasons` `[]`.
- `applyTilts(BASE_WEIGHTS.moderado, mk({ realRate: 8.7 }))` → `ipca 35`, `acoes 10`, 1 reason que casa com `/juro real/i`.
- Proteção contra negativo: `applyTilts({pos:2, ipca:50, fii:20, acoes:3, exterior:25}, mk({ realRate: 3 }))` → `pos 0`, `acoes 5`, soma 100.
- Gatilhos compatíveis juntos:
  - Arrojado + `mk({ realRate: 8.7, indices: { ibov: { fromHigh: -20 }, xfix11: { fromHigh: -12 } }, dolar: { change12m: 16 } })` → `{ pos: 0, ipca: 30, fii: 25, acoes: 25, exterior: 20 }`, 4 reasons.
  - Conservador + `mk({ realRate: 3, indices: { ibov: { fromHigh: -20 }, xfix11: { fromHigh: -12 } }, dolar: { change12m: -12 } })` → `{ pos: 20, ipca: 35, fii: 20, acoes: 15, exterior: 10 }`, 4 reasons.
- Dólar: `mk({ dolar: { last: 6, change12m: 16 } })` no moderado → `exterior 10`, `ipca 35`.
- `suggestAllocation({ surplus: 1200, profile: "moderado", reserve: 0, reserveTarget: 8000, market: null })` → `toReserve 840`, `byClass { pos: 90, ipca: 100, fii: 70, acoes: 50, exterior: 50 }`, `total 1200`.
- `suggestAllocation({ surplus: 1000, profile: "moderado", reserve: 9000, reserveTarget: 8000, market: mk({ realRate: 8.7 }) })` → `toReserve 0`, `byClass { pos: 200, ipca: 350, fii: 200, acoes: 100, exterior: 150 }`.
- Déficit: `surplus: -300` → `total 0`, `toReserve 0`, todas as classes 0.
- Meta 0: `reserveTarget: 0`, `surplus: 500`, conservador → `toReserve 0`, soma das classes 500.
- Sobra pequena: `surplus: 7`, reserva cheia → `pos 7`, demais 0.
- `reserveTarget` com gastos de 3000 (`2026-09`), 0 (`2026-10`) e 4000 (`2026-11`) → `21000`, porque 6 × média(3000, 4000); sem nenhum gasto → `0`.
- `futureValue(10000, 1000, 4.5, 10)` → `toBeCloseTo(166005.37, 0)`; `futureValue(10000, 1000, 0, 10)` → `130000`.
- `monthlyIncomeFrom(600000)` → `2000`.
- `yearsToGoal(10000, 1000, 4.5, 2000)` → `25.7`; `yearsToGoal(0, 0, 4.5, 2000)` → `null`.
- `extrasHint(0)` → `null`; `extrasHint(600)` contém `"R$ 480,00"` (normalizar o NBSP do `Intl` antes de comparar).

(`mk(partial)` é um helper do teste. Ele monta um `Market` com tudo `null` e sobrescreve com `partial`. O `realRate` vai direto no campo. Índices e dólar parciais são completados com `{ last: 1, change12m: 0, fromHigh: 0 }`.)

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implementar `invest.ts`** conforme as interfaces e valores acima. O texto das `reasons` é livre, mas cada frase cita o indicador e o número (ex.: "Juro real em 8,7% ao ano: título atrelado à inflação está pagando bem; reforçamos Tesouro IPCA+.").
- [ ] **Step 4:** `npm test` → PASS; `npx tsc --noEmit` sem erros.

---

### Task 6: Aba Investir + nova navegação

**Files:**
- Create: `src/components/invest-view.tsx`
- Modify: `src/components/charts.tsx` (acrescentar `ProjectionChart`), `src/components/shell.tsx` (aba e navegação), `src/lib/store.ts` (`setInvest`, já criado na Task 1)

**Interfaces:**
- Consumes: `useMarket` (Task 4); tudo de `invest.ts` (Task 5); `incomeSplit`, `compute`, `setInvest`, `update` (Task 1 e existentes).
- Produces:
  - `InvestView({ data, month }: { data: AppData; month: string })`.
  - `ProjectionChart({ points }: { points: { year: number; value: number }[] })`.
  - Em `shell.tsx`: `MoreSheet({ open, onClose, go, tab })`, com um espaço para `InstallCard` (Task 7).

**Aba:**
- `TABS` ganha `{ id: "investir", label: "Investir", icon: ChartLine }`, depois de "gastos".
- A sidebar do desktop mostra as 8 abas.
- Barra inferior:
  - `MOBILE_MAIN = ["resumo", "gastos", "rendas", "investir"]` mais um botão "Mais" (`Ellipsis`) que abre `MoreSheet` (usa `Modal`, título "Mais opções") com botões grandes para fixas, relatorio, holerite e dados.
  - "Mais" fica destacado quando a aba atual não está em `MOBILE_MAIN`.
  - Cada item da barra com `flex-1`; remover `overflow-x-auto` e `min-w-[72px]`.

**`InvestView`** (seções na ordem do spec 5.4):
1. **Cabeçalho**:
   - título "Investimentos";
   - "Sobra do mês: {money(max(0, c.balance))}";
   - "Já investido este mês: {money(c.byCat.Investimentos)}", só se > 0;
   - selo do perfil com botão "Refazer perfil";
   - o aviso exato das Global Constraints.
2. **Questionário**, quando não houver `data.invest?.profile` (ou ao clicar em "Refazer perfil"): as 3 perguntas de `QUIZ` como grupos de botões. Ao concluir, `setInvest({ profile: profileFromAnswers(...) })`.
3. **Panorama**:
   - grid `grid-cols-2 sm:grid-cols-3` com Selic, IPCA 12m, Juro real, Dólar (com a variação de 12m no `sub`), Ibovespa 12m e S&P 500 12m;
   - valor `null` aparece como "—";
   - rodapé "Fontes: Banco Central do Brasil e Yahoo Finance · atualizado em {dd/MM HH:mm}"; com `status "cached"`, acrescenta "· sem conexão, mostrando dados salvos";
   - com `"loading"` e sem cache, mostra um skeleton.
4. **"Como dividir seus {money(surplus)}"**:
   - se `total === 0`, mostra o `Empty` "Sem sobra para investir este mês";
   - senão: linha da reserva (se `toReserve > 0`, com "faltam {money(missing)}") e uma linha por `CLASSES` com `ProgressBar` (largura = valor / total), valor, exemplo e o `what`;
   - em seguida, `TipList` de "Por que este mês" (`reasons` + `extrasHint(extra)`, nível `info`);
   - botão "Registrar aporte".
5. **Modal "Registrar aporte"**:
   - campos: valor (`MoneyInput`, padrão = `total`), data (padrão igual aos gastos) e destino (`Select`: "Reserva de emergência" | "Investimentos");
   - ao salvar, cria um gasto `{ desc: "Aporte – Reserva de emergência" | "Aporte – Investimentos", category: "Investimentos", amount, date }` e chama `setInvest` somando o valor em `reserve` ou `invested`.
6. **"Renda futura"**:
   - campos (`MoneyInput`/`Input`) para já investido, reserva, meta de renda mensal, aporte mensal (estado local, padrão `total`) e rentabilidade real % (padrão `DEFAULT_REAL_RETURN[profile]`, salva em `realReturn`);
   - `ProjectionChart` com `futureValue` para os anos 0..20;
   - três cartões (5, 10 e 20 anos) com o patrimônio e "≈ {money(monthlyIncomeFrom(v))}/mês";
   - com meta definida: "Você alcança {money(goal)}/mês em ~{yearsToGoal} anos", ou "Com esse aporte a meta não é alcançada em 100 anos" quando o resultado for `null`.

- [ ] **Step 1: Ler** `node_modules/recharts` (tipos de `AreaChart`) só se for preciso; seguir o estilo de `HistoryChart`.
- [ ] **Step 2: Implementar `ProjectionChart`, `InvestView`, a aba e a navegação**
- [ ] **Step 3: Verificar**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo sem erros.
Run: `grep -n "overflow-x-auto" src/components/shell.tsx` → nenhum resultado.

---

### Task 7: PWA (manifest, ícones, service worker, instalar)

Ler antes: `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`, `03-api-reference/03-file-conventions/01-metadata/manifest.md` e `app-icons.md`.

**Files:**
- Create: `scripts/generate-icons.mjs`; script `"icons": "node scripts/generate-icons.mjs"` no `package.json`
- Create (gerados e versionados): `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`, `src/app/apple-icon.png` (180×180)
- Create: `src/app/manifest.ts`, `public/sw.js`, `src/components/pwa.tsx`
- Modify: `next.config.ts` (`headers()`), `src/app/layout.tsx` (`appleWebApp`), `src/components/shell.tsx` (registrar SW; `InstallCard` no `MoreSheet`), `src/components/dashboard.tsx` (`InstallBanner` no topo)

**Interfaces:**
- Produces (em `pwa.tsx`, `"use client"`):
  - `useRegisterSW(): void`: registra `/sw.js` com `{ scope: "/", updateViaCache: "none" }`, só quando `process.env.NODE_ENV === "production"` e `"serviceWorker" in navigator`.
  - `useInstall(): { canPrompt: boolean; prompt: () => Promise<void>; isIOS: boolean; installed: boolean }`. `installed` vem de `matchMedia("(display-mode: standalone)")` ou `navigator.standalone`; `isIOS` de `/iPhone|iPad|iPod/` ou (`Macintosh` + `maxTouchPoints > 1`).
  - `InstallBanner()`: só `lg:hidden`, oculto se `installed` ou se `localStorage["cf-install-dismissed"] === "1"`, com botão X para dispensar.
  - `InstallCard()`.
  - Conteúdo: no Android (`canPrompt`), botão "Instalar app"; no iOS, os passos "Toque em Compartilhar (ícone ⬆) → Adicionar à Tela de Início"; se já estiver `installed`, "App já instalado neste aparelho".

Valores fixos:
- `manifest.ts`:
  - `name "Meu Controle Financeiro"`, `short_name "Financeiro"`, `description` igual à do `metadata`;
  - `start_url "/"`, `scope "/"`, `display "standalone"`, `orientation "portrait"`, `lang "pt-BR"`;
  - `background_color "#f4f6f9"`, `theme_color "#059669"`;
  - `icons`: 192 e 512 com `purpose "any"`, e `maskable-512` com `purpose "maskable"`.
- Ícone: quadrado verde `#059669` com o desenho `Wallet` do lucide em branco (traço 2, paths `M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1` e `M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4`, viewBox 24).
  - Normal: desenho ocupando 56% do lado, cantos arredondados de 22%.
  - Maskable: fundo sem arredondamento, desenho ocupando 40% (zona segura).
  - Gerar com `import og from "next/og.js"` + `new og.ImageResponse(createElement(...), { width, height })`. Já testado: funciona em Node 20.
- `layout.tsx` `metadata.appleWebApp = { capable: true, title: "Financeiro", statusBarStyle: "default" }`.
- `next.config.ts` `headers()` para `/sw.js`: `Content-Type: application/javascript; charset=utf-8`, `Cache-Control: no-cache, no-store, must-revalidate`, `Content-Security-Policy: default-src 'self'; script-src 'self'`.
- `sw.js`, com `const VERSION = "cf-v1"`:
  - `install`: pré-carrega `["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"]` e chama `skipWaiting()`.
  - `activate`: apaga caches com outro nome e chama `clients.claim()`.
  - `fetch`, só `GET` da mesma origem:

| Requisição | Estratégia |
|---|---|
| `/_next/static/*`, `/icons/*` | cache primeiro |
| `request.mode === "navigate"` | rede primeiro, cai para o cache da URL ou `"/"` |
| `/api/mercado` | rede primeiro, cai para o cache |
| demais | passa direto (sem cache) |

- [ ] **Step 1: Escrever o script e gerar os ícones**

Run: `npm run icons`
Expected: os 4 PNGs criados. Abrir cada um com a ferramenta Read (visualização de imagem, não é navegador) e conferir a carteira branca centralizada no fundo verde.

- [ ] **Step 2: Implementar o manifest, a metadata, os headers, `sw.js`, `pwa.tsx` e as integrações**
- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm run build`, depois `npx next start -p 3100` em segundo plano. Conferir:
- `curl -s localhost:3100/manifest.webmanifest` → JSON com `"display":"standalone"` e 3 ícones.
- `curl -sI localhost:3100/sw.js` → `Cache-Control: no-cache, no-store, must-revalidate`.
- `curl -sI localhost:3100/icons/icon-512.png` → `200` e `image/png`.
- `curl -s localhost:3100/ | grep -o -E 'rel="manifest"|apple-touch-icon|viewport-fit=cover|apple-mobile-web-app-title|mobile-web-app-capable'` → os 5 aparecem.

Encerrar o servidor.

---

### Task 8: Verificação final e README

**Files:**
- Modify: `README.md`: novas funções (instalar no celular, renda extra, aba Investir), fontes de dados, `npm test`, `npm run icons`.

- [ ] **Step 1:** `npm test && npx tsc --noEmit && npm run lint && npm run build`: tudo verde; colar a saída resumida no relatório.
- [ ] **Step 2:** `next start` + `curl` de `/`, `/api/mercado`, `/manifest.webmanifest` e `/sw.js`: todos `200`.
- [ ] **Step 3:** Atualizar o README.
- [ ] **Step 4:** Preparar para o usuário uma lista curta do que conferir no celular após o deploy:
  - cada item da tabela 5.2 do spec;
  - instalar o app (Android e iPhone);
  - adicionar uma renda extra;
  - abrir a aba Investir com e sem internet.
