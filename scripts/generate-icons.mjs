// Gera os ícones PNG do app (PWA e iPhone) a partir do desenho "Wallet" do lucide.
// Uso: npm run icons  (os PNGs gerados ficam versionados; rode de novo só se mudar o desenho)
import og from "next/og.js";
import { createElement as h } from "react";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND = "#059669";
const WALLET = [
  "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
  "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
];

/** size: lado em px · glyph: fração do lado ocupada pelo desenho · radius: fração do lado (0 = quadrado) */
function icon(size, glyph, radius) {
  const g = Math.round(size * glyph);
  return h(
    "div",
    { style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND, borderRadius: Math.round(size * radius) } },
    h(
      "svg",
      { width: g, height: g, viewBox: "0 0 24 24", fill: "none", stroke: "white", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
      ...WALLET.map((d) => h("path", { d })),
    ),
  );
}

const out = [
  ["public/icons/icon-192.png", 192, 0.56, 0.22],
  ["public/icons/icon-512.png", 512, 0.56, 0.22],
  ["public/icons/maskable-512.png", 512, 0.4, 0], // zona segura para recorte do Android
  ["src/app/apple-icon.png", 180, 0.56, 0], // o iPhone aplica o próprio arredondamento
];

for (const [file, size, glyph, radius] of out) {
  const res = new og.ImageResponse(icon(size, glyph, radius), { width: size, height: size });
  const buf = Buffer.from(await res.arrayBuffer());
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  console.log(`${file} (${size}×${size}, ${buf.length} bytes)`);
}
