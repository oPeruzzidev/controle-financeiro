# Meu Controle Financeiro

Plataforma de controle financeiro pessoal (Next.js + React + TypeScript + Tailwind + Recharts).

- Cadastro de **rendas fixas** (todo mês) e **rendas extras** (freelance, hora extra, vendas… com data e origem), **contas fixas** e **gastos** por categoria
- **Relatório** com % de consumo da renda, regra 50/30/20 e **recomendações de economia**
- **Investir**: divide a sobra do mês entre reserva de emergência, renda fixa, fundos imobiliários, ações e exterior, conforme o seu perfil e o panorama de mercado do mês, e projeta a renda futura
- **Upload de holerite** (PDF/imagem) lido no próprio navegador (pdf.js + OCR Tesseract) com análise de descontos
- **Instalável no celular** (PWA): ícone na tela inicial, tela cheia e abre sem internet
- Dados salvos **somente no navegador** (localStorage), com exportar/importar backup JSON
- Tema claro/escuro, responsivo (desktop e celular)

## Dados de mercado

A rota `GET /api/mercado` busca só dados públicos (nenhum dado pessoal sai do aparelho) e guarda em cache por 24 h:

- **Banco Central do Brasil**: Selic, CDI, IPCA 12 meses, dólar PTAX e expectativa de inflação do Boletim Focus
- **Yahoo Finance** (fonte não oficial; se cair, a tela mostra só o Banco Central): Ibovespa, S&P 500, BOVA11, IVVB11, XFIX11

As sugestões da aba Investir são educativas e geradas por regras (`src/lib/invest.ts`). Não são recomendação de investimento profissional.

## Rodar localmente

```bash
npm install
npm run dev      # desenvolvimento
npm test         # testes (Vitest)
npm run lint
npm run build
```

O service worker só é registrado no build de produção (`npm run build && npm start`).

### Ícones do app

Os PNGs em `public/icons/` e `src/app/apple-icon.png` são gerados por `npm run icons` (`scripts/generate-icons.mjs`). Rode de novo só se mudar o desenho.
