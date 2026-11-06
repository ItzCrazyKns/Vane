/* Runs the automatic checks on a saved eval run.

     npx tsx perf-audit/eval/checks.ts --run <label> [--ref <label>]

   With --ref, a check counts as a regression only when the reference
   answer passed it and the new answer does not. The process exits with 1
   when there is any regression (or any failure, without --ref). */
import fs from 'node:fs';
import path from 'node:path';
import { EvalRecord, runChecks } from './lib/checks';

const RUNS = path.resolve(__dirname, 'runs');

const load = (label: string) => {
  const dir = path.join(RUNS, label);
  const out = new Map<string, EvalRecord>();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || f === 'summary.json' || f.startsWith('checks'))
      continue;
    const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    out.set(`${rec.id}.${rec.mode}`, rec);
  }
  return out;
};

const args = process.argv.slice(2);
const get = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const runLabel = get('run');
const refLabel = get('ref');
if (!runLabel) throw new Error('--run <label> is required');

const run = load(runLabel);
const ref = refLabel ? load(refLabel) : undefined;

const rows: any[] = [];
let failures = 0;
for (const [key, rec] of [...run.entries()].sort()) {
  const refRec = ref?.get(key);
  const now = runChecks(rec, refRec);
  const before = refRec ? runChecks(refRec, refRec) : undefined;
  for (const c of now) {
    const refPassed = before?.find((b) => b.name === c.name)?.pass;
    const regression = ref ? !c.pass && refPassed !== false : !c.pass;
    if (regression) failures++;
    rows.push({ key, ...c, refPassed, regression });
  }
}

const out = path.join(
  RUNS,
  runLabel,
  refLabel ? `checks-vs-${refLabel}.json` : 'checks.json',
);
fs.writeFileSync(out, JSON.stringify(rows, null, 2));

const byName = new Map<string, { pass: number; total: number }>();
rows.forEach((r) => {
  const s = byName.get(r.name) ?? { pass: 0, total: 0 };
  s.total++;
  if (r.pass) s.pass++;
  byName.set(r.name, s);
});
console.log('Verificação                   aprovadas');
byName.forEach((s, n) => console.log(`${n.padEnd(30)} ${s.pass}/${s.total}`));
rows
  .filter((r) => r.regression)
  .forEach((r) => console.log(`FALHA ${r.key} ${r.name} ${r.detail ?? ''}`));
console.log(
  `\n${failures} ${ref ? 'regressões' : 'falhas'}. Detalhes em ${path.relative(process.cwd(), out)}`,
);
process.exit(failures ? 1 : 0);
