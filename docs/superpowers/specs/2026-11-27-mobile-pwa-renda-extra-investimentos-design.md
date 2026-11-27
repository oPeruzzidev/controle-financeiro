# Melhorias: app no celular, renda extra e aba de investimentos

Data: 2026-11-27 · Projeto: Meu Controle Financeiro (Next.js 16, React 19, Tailwind 4, Recharts) · Produção: Vercel

## 1. Intenção

App pessoal de controle financeiro, usado principalmente pelo celular. O dono quer:

1. **Atalho na tela inicial**: abrir o app como se fosse um aplicativo instalado (ícone, tela cheia).
2. **Corrigir os bugs visuais no celular.**
3. **Registrar ganhos extras** que mudam de mês a mês (freelance, hora extra, vendas, comissões), separados do salário.
4. **Aba de investimentos** que pega a sobra do salário e sugere como dividi-la entre investimentos variados, com o objetivo de **construir uma renda complementar no futuro**. As sugestões se atualizam com dados reais da bolsa brasileira e internacional.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Instalável no Android (prompt nativo) e no iPhone (instrução "Compartilhar → Adicionar à Tela de Início"), abrindo em tela cheia e funcionando offline com os dados locais.
- Nenhum conteúdo cortado, estourado ou escondido em telas de 320 a 430 px de largura; sem zoom automático ao digitar no iPhone.
- Renda extra com data e origem, mostrada separada da renda fixa no Resumo e na aba Rendas.
- Aba "Investimentos" com: panorama de mercado atualizado, divisão sugerida da sobra do mês, projeção da renda futura e registro de aportes.

**Não-objetivos**
- Indicar ações ou ativos individuais para comprar. As sugestões são por **classe de investimento**, com exemplos genéricos (Tesouro IPCA+, ETFs como BOVA11/IVVB11).
- Sincronizar dados entre aparelhos (continua o backup manual em "Dados").
- Texto de análise escrito por IA (fica preparado para depois; ver Abordagens).
- Acompanhar cotação da carteira real do usuário.

**Anti-objetivos** (falharia mesmo "funcionando")
- Enviar dados financeiros pessoais para qualquer servidor. O servidor só busca **dados públicos de mercado**; todo cálculo pessoal acontece no aparelho.
- Apresentar as sugestões como recomendação profissional. A tela deixa claro que são sugestões educativas automáticas.
- Quebrar dados já salvos ou backups antigos.
- Tela de investimentos que fica em branco ou trava quando uma fonte de dados cai.

## 3. Restrições

- **Sem navegador na máquina de desenvolvimento.** Nada de Playwright, Chrome ou emulação. A verificação é feita com `build`, `lint`, checagem de tipos, testes unitários, `curl` contra `next start` local e leitura do CSS/markup. A confirmação visual final é do usuário, no celular, após o deploy.
- Next.js 16 tem mudanças incompatíveis com versões anteriores: ler o guia relevante em `node_modules/next/dist/docs/` antes de escrever cada parte (manifest, service worker/PWA, route handlers, cache).
- Node 20 local (sem execução nativa de TypeScript); testes via Vitest.
- Dados continuam em `localStorage` na chave `controle-financeiro:v2`. Campos novos são opcionais e o `sanitize()` aceita backups antigos e novos.
- Deploy: quem publica é o usuário. Nada é publicado nem enviado sem pedido explícito.

## 4. Abordagens consideradas (para a análise de mercado)

| | Como funciona | Prós | Contras |
|---|---|---|---|
| **A. Regras + dados atualizados** ✅ escolhida | Uma rota no servidor da Vercel busca indicadores públicos e guarda o resultado em cache por 24 h. O app aplica regras claras para dividir a sobra. | Custo zero, sem chave de API, transparente, dados pessoais nunca saem do aparelho. | Textos seguem modelos; não lê notícias. |
| B. A + comentário mensal por IA | Uma vez por mês, só os indicadores vão para a API do Claude, que escreve um panorama. | Texto mais rico. | Exige chave paga da Anthropic e configuração na Vercel. |
| C. Tarefa agendada que pesquisa e altera o código no GitHub | Um agente pesquisa notícias todo mês e commita um JSON. | Análise mais completa. | Muitas peças frágeis (repo, agendamento, redeploy). Descartada. |

**Escolhida: A** (decisão do usuário). A rota de mercado devolve um objeto estável, de modo que B possa ser acrescentada depois sem refazer a tela.

**Fontes de dados verificadas em 27/11/2026**

| Fonte | O que traz | Situação |
|---|---|---|
| Banco Central SGS `api.bcb.gov.br/dados/serie/bcdata.sgs.{n}` | 432 Selic meta, 4389 CDI anual, 13522 IPCA 12 meses, 1 dólar PTAX | Oficial, gratuita, sem chave ✅ |
| Banco Central Olinda (Focus) `olinda.bcb.gov.br/.../ExpectativasMercadoAnuais` | Expectativa de IPCA e Selic (mediana) | Oficial, gratuita ✅ |
| Yahoo Finance `query1.finance.yahoo.com/v8/finance/chart/{símbolo}` | ^BVSP, ^GSPC, BOVA11.SA, IVVB11.SA, XFIX11.SA (histórico mensal de 1 ano) | Gratuita, **não oficial**: tratar como opcional ✅ |
| brapi.dev | Cotações B3 | Exige token para a maioria dos ativos ❌ |
| JSON do Tesouro Direto | Taxas dos títulos | Bloqueado (403) ❌ |

Observação: o `meta.fiftyTwoWeekLow` do Yahoo veio zerado; calcular máximas e variações a partir dos fechamentos mensais, nunca dos campos `meta`.

## 5. Design

### 5.1 Atalho na tela inicial (PWA)

- **Manifest** via convenção de metadados do App Router (`app/manifest.ts`): nome "Meu Controle Financeiro", nome curto "Financeiro", `display: standalone`, `start_url: "/"`, cores de fundo e tema iguais às de `globals.css`, ícones 192 e 512 (comum e `maskable`).
- **Ícones** gerados pelo próprio Next (`ImageResponse`) a partir do logo atual (carteira em fundo verde `#059669`), incluindo `apple-icon` 180×180. Assim não é preciso ferramenta de imagem externa nem navegador.
- **iPhone**: `appleWebApp` (capable, título, barra de status) e `viewportFit: "cover"`. O cabeçalho e a barra inferior respeitam `safe-area-inset-top` e `-bottom`.
- **Service worker** simples (`public/sw.js`), registrado só em produção:
  - arquivos estáticos (`/_next/static`, ícones): cache primeiro;
  - páginas: rede primeiro, com a última versão em cache como reserva (abre offline);
  - `/api/mercado`: rede primeiro, com o último resultado em cache como reserva.
- **Botão "Instalar app"**:
  - Android/Chrome: captura `beforeinstallprompt` e mostra um botão.
  - iPhone: mostra o passo a passo "Compartilhar → Adicionar à Tela de Início".
  - Aparece como faixa dispensável no Resumo (só no celular e só se ainda não estiver instalado) e de forma permanente no menu "Mais".

### 5.2 Bugs visuais no celular

Encontrados pela leitura do código (sem navegador):

| # | Problema | Onde | Correção |
|---|---|---|---|
| 1 | Campos com fonte de 15 px fazem o iPhone dar zoom ao focar | `ui.tsx` `inputCls` | 16 px no celular (`text-base`), 15 px a partir de `sm` |
| 2 | Valores em `text-2xl` estouram os cartões de 2 colunas (~131 px úteis em 390 px) | `Stat` em `ui.tsx`, Resumo e Holerite | Fonte responsiva (`text-xl sm:text-2xl`), padding menor no celular, `min-w-0` e quebra segura |
| 3 | Barra inferior com 7 abas (8 com Investimentos) rola para o lado e esconde abas | `shell.tsx` | Barra com 5 itens: **Resumo · Gastos · Rendas · Investir · Mais**. "Mais" abre uma folha com Contas fixas, Relatório, Holerite, Dados e Instalar app |
| 4 | Cabeçalho apertado em 320–360 px (logo + seletor `min-w-36` + tema) | `shell.tsx` | Rótulo curto do mês no celular ("Nov 2026"), largura mínima menor |
| 5 | Selos (categoria + "vence dia X" + data) sem quebra de linha estouram a linha | `lists.tsx` `Row` | `flex-wrap`, `min-w-0` |
| 6 | Folha do modal usa `92vh`: no iPhone a barra do Safari e o teclado escondem o botão Salvar | `Modal` em `ui.tsx` | `dvh`, padding inferior com safe-area, rolagem interna |
| 7 | `min-h-screen`/`h-screen` com `vh` "pulam" no celular | `shell.tsx` | `dvh` |
| 8 | Campo de data dentro de `grid-cols-2` pode estourar no iOS | Formulários de gastos/contas | `min-w-0` nos filhos do grid, `appearance-none` no campo de data |
| 9 | `background-attachment: fixed` no tema escuro causa travadas no iOS | `globals.css` | Fundo em pseudo-elemento `position: fixed` |
| 10 | Linhas "nome ↔ % · valor" do Relatório e da legenda do gráfico se espremem | `report.tsx`, `charts.tsx` | `flex-wrap`/`shrink`, valor em linha própria quando faltar espaço |
| 11 | Destaque azul ao tocar em botões no Android | global | `-webkit-tap-highlight-color: transparent` |
| 12 | Cabeçalho das listas (título + total + botão) desalinha ao quebrar | `lists.tsx` `Header` | No celular, total e botão numa linha própria de largura total |

Bugs que o usuário vir no aparelho e que não estejam nesta lista entram na mesma rodada.

### 5.3 Renda extra

- **Modelo**: `Income` ganha dois campos opcionais, `date?: "YYYY-MM-DD"` e `source?: string` (Freelance, Hora extra, Comissão, Venda, Aluguel, Bônus, Outros). Os valores de `type` continuam `recorrente | unica` para manter compatibilidade; na interface eles se chamam **"Fixa (todo mês)"** e **"Extra (só neste mês)"**.
- **Aba Rendas**: duas seções, "Renda fixa" e "Extras do mês", cada uma com seu total. Botão principal "+ Renda extra" (já vem com tipo extra e data de hoje) e um secundário "+ Renda fixa". Cada extra mostra a origem e a data. Abaixo, a média dos extras nos últimos 6 meses.
- **Resumo**: o cartão "Renda do mês" mostra "fixa R$ X + extras R$ Y".
- **Ligação com investimentos**: se houver extras no mês, a aba Investimentos sugere destinar a maior parte deles a investimentos ("dinheiro que não estava no orçamento").
- Rendas "única" antigas aparecem como extras sem origem e com data no dia 1 do mês.

### 5.4 Aba Investimentos

**Dados novos** (opcionais, dentro de `AppData`, entram no backup):

```ts
invest?: {
  profile?: "conservador" | "moderado" | "arrojado";
  invested: number;        // quanto já tem investido (fora a reserva)
  reserve: number;         // quanto tem na reserva de emergência
  goalMonthly?: number;    // renda extra mensal desejada no futuro
  realReturn?: number;     // rentabilidade real anual esperada (%), padrão pelo perfil
}
```

Aportes continuam sendo **gastos na categoria "Investimentos"** (já existe e já entra como "poupança" no 50/30/20). O botão "Registrar aporte" cria esse gasto e soma o valor em `invested` ou `reserve`.

**Rota de mercado** `GET /api/mercado` (servidor, cache de 24 h):
- Busca em paralelo; cada fonte é independente e pode falhar sozinha.
- Resposta: `{ updatedAt, selic, cdi, ipca12m, ipcaExpect, dolar, indices: { ibov, sp500, bova11, ivvb11, xfix11 }, errors[] }`. Cada índice traz o último fechamento, a variação em 12 meses e a distância da máxima de 12 meses.
- `ipcaExpect` = mediana do Focus `ExpectativasMercadoInflacao12Meses` (IPCA, suavizada, `baseCalculo 0`), a mais recente. Se não vier, usa `ipca12m`.
- Variação do dólar em 12 meses: SGS série 1 com `dataInicial`/`dataFinal` (primeiro valor de há 1 ano × último valor).
- Derivado: juro real ≈ `(1+selic)/(1+ipcaExpect) − 1`.
- O cliente guarda o último resultado bom em `localStorage` e mostra "dados de DD/MM" quando estiver offline ou com fonte fora do ar.

**Lógica pura** (`lib/invest.ts`, toda testada):

1. **Valor a dividir** = sobra do mês (`compute().balance`), mínimo 0. Aportes já registrados no mês aparecem à parte ("já investido este mês").
2. **Reserva primeiro**: meta = 6 × média do consumo dos últimos 3 meses (só os meses com dados; se não houver nenhum, usa o mês atual). Enquanto `reserve` < meta, vai para a reserva 100% da sobra (conservador), 70% (moderado) ou 50% (arrojado), limitado ao que falta.
3. **Pesos base do restante, por perfil** (%):

| Classe | Conservador | Moderado | Arrojado |
|---|---|---|---|
| Renda fixa pós (Tesouro Selic / CDB liquidez) | 40 | 20 | 10 |
| Renda fixa inflação (Tesouro IPCA+) | 35 | 30 | 20 |
| Fundos imobiliários (renda mensal) | 15 | 20 | 20 |
| Ações Brasil (ETF / dividendos) | 5 | 15 | 25 |
| Exterior (ETF S&P 500 / IVVB11) | 5 | 15 | 25 |

4. **Ajustes do mês**: cada regra move no máximo 5 pontos e gera uma frase em "Por que este mês". Ajustes que dependem de uma fonte indisponível são pulados.
   - Juro real > 6%: +5 em IPCA+, tirados de ações BR.
   - Juro real < 4%: +5 em ações BR, tirados da renda fixa pós.
   - Ibovespa ≥ 15% abaixo da máxima de 12 meses: +5 em ações BR, tirados da renda fixa pós.
   - Dólar subiu > 15% em 12 meses: −5 no exterior, +5 em IPCA+.
   - Dólar caiu > 10% em 12 meses: +5 no exterior, tirados da renda fixa pós.
   - XFIX11 (fundos imobiliários) ≥ 10% abaixo da máxima de 12 meses: +5 em FIIs, tirados da renda fixa pós.
   - Nenhum peso fica negativo; a soma é sempre 100%.
   - Valores arredondados para R$ 10; a sobra do arredondamento vai para a renda fixa pós.
5. **Projeção da renda futura**: patrimônio futuro com aporte mensal constante (padrão: a sugestão do mês, editável) e rentabilidade real anual (padrão 3,5%, 4,5% e 5,5% por perfil, editável).
   - Renda mensal sustentável = patrimônio × 4% ÷ 12, em valores de hoje.
   - Mostra o patrimônio e a renda em 5, 10 e 20 anos.
   - Se houver meta de renda, mostra em quantos anos ela é alcançada.

**Tela** (ordem no celular):
1. Cabeçalho: sobra do mês, perfil (editável) e aviso de "sugestão educativa, não é recomendação profissional".
2. Questionário de perfil (só se `profile` não existir; pode ser refeito):
   - 3 perguntas curtas: prazo até precisar do dinheiro, reação a uma queda de 20% e experiência com investimentos.
   - Cada resposta vale 0, 1 ou 2 pontos. Soma de 0–2 = conservador, 3–4 = moderado, 5–6 = arrojado.
3. Panorama do mercado: cartões com Selic, IPCA 12m, juro real, dólar, Ibovespa 12m e S&P 500 12m, com a data de atualização e a fonte.
4. "Como dividir seus R$ X": barras por classe com valor, exemplo de produto e uma linha do que é. Abaixo, "Por que este mês" e o botão "Registrar aporte" (modal com valor, data e destino: reserva ou investimentos).
5. "Renda futura": campos de já investido, reserva, meta, aporte e rentabilidade, mais um gráfico da evolução do patrimônio (Recharts, já no projeto) e os marcos de 5, 10 e 20 anos.

Na navegação: aba "Investir" (ícone de gráfico subindo) no desktop e na barra inferior.

## 6. Testes e verificação

- **Vitest** (nova dependência de desenvolvimento) para a lógica pura:
  - `lib/invest.ts`: reserva, pesos, ajustes, arredondamento, projeção;
  - parsers da rota de mercado, com respostas reais gravadas como exemplo;
  - `sanitize()` com backups antigos e novos;
  - totais de renda fixa e extra.
- `npm run lint`, `tsc --noEmit` e `npm run build` sem erros.
- `next start` local + `curl` em `/`, `/manifest.webmanifest`, ícones, `/sw.js` e `/api/mercado` (inclusive simulando uma fonte fora do ar).
- Itens visuais: conferidos no código contra a tabela 5.2; confirmação final do usuário no celular após o deploy.

## 7. Decisões deixadas para quem implementar

- Nomes de arquivos e componentes; divisão de `lists.tsx` se crescer demais.
- API exata de cache da rota (seguir os docs do Next 16 instalados).
- Texto das frases de "Por que este mês" e dos exemplos de produto, desde que sigam a seção 5.4.
- Visual fino dos cartões, seguindo o estilo atual (variáveis de cor, `.card`, Tailwind).
