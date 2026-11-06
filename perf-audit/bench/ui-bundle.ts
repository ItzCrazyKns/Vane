/**
 * Mede o JS de primeira carga por rota e os maiores chunks de um build de
 * produção. O Next 16 não imprime mais "First Load JS" e os
 * client-reference-manifests por rota vêm mesclados (listam módulos de outras
 * rotas), então medimos o que o navegador realmente baixa: buscamos o HTML de
 * cada rota num `next start` com o setup concluído e somamos os
 * `<script src>` (os chunks de next/dynamic e import() ficam de fora).
 *
 * Uso:
 *   yarn build && DATA_DIR=<pasta com drizzle/> npx next start -p 3471
 *   npx tsx perf-audit/bench/ui-bundle.ts [http://127.0.0.1:3471]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const NEXT = path.resolve(process.cwd(), '.next');
const BASE = process.argv[2] || 'http://127.0.0.1:3471';
const ROUTES = ['/', '/c/bench', '/discover', '/library'];

const sizeCache = new Map<string, { raw: number; gz: number }>();
const sizeOf = (rel: string) => {
  let s = sizeCache.get(rel);
  if (!s) {
    const buf = fs.readFileSync(path.join(NEXT, rel));
    s = { raw: buf.length, gz: zlib.gzipSync(buf, { level: 9 }).length };
    sizeCache.set(rel, s);
  }
  return s;
};

const MARKERS: Record<string, RegExp> = {
  jspdf: /jsPDF|AcroForm/,
  'lightweight-charts': /createChart|LineSeries|AreaSeries/,
  'highlight.js': /hljs|highlightAuto/,
  prismjs: /Prism\.languages|refractor/,
  'framer-motion': /AnimatePresence|useAnimationFrame/,
};

const kb = (n: number) => (n / 1024).toFixed(1);

const main = async () => {
  console.log('First Load JS por rota (raw KB / gzip KB / scripts):');
  for (const route of ROUTES) {
    const html = await (await fetch(BASE + route)).text();
    const files = new Set(
      [...html.matchAll(/<script[^>]+src="\/_next\/([^"]+\.js)[^"]*"/g)].map(
        (m) => decodeURIComponent(m[1]),
      ),
    );
    let raw = 0;
    let gz = 0;
    for (const f of files) {
      const s = sizeOf(f);
      raw += s.raw;
      gz += s.gz;
    }
    console.log(
      `  ${route.padEnd(12)} ${kb(raw).padStart(8)}  ${kb(gz).padStart(7)}  ${files.size}`,
    );
  }

  const chunksDir = path.join(NEXT, 'static/chunks');
  const all: { name: string; raw: number; gz: number; libs: string[] }[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) {
        const src = fs.readFileSync(p, 'utf8');
        const libs = Object.entries(MARKERS)
          .filter(([, re]) => re.test(src))
          .map(([k]) => k);
        all.push({
          name: path.relative(chunksDir, p),
          ...sizeOf(path.relative(NEXT, p)),
          libs,
        });
      }
    }
  };
  walk(chunksDir);
  all.sort((a, b) => b.raw - a.raw);

  const dirSize = (dir: string): number =>
    fs.readdirSync(dir, { withFileTypes: true }).reduce((acc, e) => {
      const p = path.join(dir, e.name);
      return acc + (e.isDirectory() ? dirSize(p) : fs.statSync(p).size);
    }, 0);

  console.log(
    `\n.next/static total: ${kb(dirSize(path.join(NEXT, 'static')))} KB`,
  );
  console.log('Maiores chunks (raw KB / gzip KB / libs detectadas):');
  for (const c of all.slice(0, 10))
    console.log(
      `  ${c.name.padEnd(40)} ${kb(c.raw).padStart(8)}  ${kb(c.gz).padStart(7)}  ${c.libs.join(',')}`,
    );
};

main();
