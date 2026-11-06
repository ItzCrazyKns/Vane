/* Applies the Phase 2 approval rule to a judged run.

     npx tsx perf-audit/eval/compare.ts --run <label> --ref <label>

   Needs runs/<ref>/scores.json (judge.ts --run <ref>) and
   runs/<run>/scores-vs-<ref>.json (judge.ts --run <run> --ref <ref>).
   A change is approved when:
     - no criterion's mean drops more than 0.3 in any mode;
     - no question drops 2 points or more on any criterion;
     - the automatic checks have no regression (checks.ts --ref).
   Writes runs/<run>/compare-vs-<ref>.md and appends the questions the judge
   failed to perf-audit/eval/review-queue.md, both answers side by side. */
import fs from 'node:fs';
import path from 'node:path';
import { EvalRecord, runChecks, visibleAnswer } from './lib/checks';

const EVAL_DIR = __dirname;
const RUNS = path.join(EVAL_DIR, 'runs');
const CRITERIA = [
  'relevance',
  'grounding',
  'completeness',
  'citationFormat',
] as const;
const MODES = ['speed', 'balanced', 'quality'] as const;
const MAX_MEAN_DROP = 0.3;
const MAX_QUESTION_DROP = 2;

const args = process.argv.slice(2);
const get = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const runLabel = get('run');
const refLabel = get('ref');
if (!runLabel || !refLabel) throw new Error('--run and --ref are required');

const readJson = (...p: string[]) =>
  JSON.parse(fs.readFileSync(path.join(...p), 'utf-8'));
const refScores: any[] = readJson(RUNS, refLabel, 'scores.json').scores;
const runScores: any[] = readJson(
  RUNS,
  runLabel,
  `scores-vs-${refLabel}.json`,
).scores;
const key = (s: { id: string; mode: string }) => `${s.id}.${s.mode}`;
const refByKey = new Map(refScores.map((s) => [key(s), s]));
const record = (label: string, k: string): EvalRecord | undefined => {
  const f = path.join(RUNS, label, `${k}.json`);
  return fs.existsSync(f) ? readJson(f) : undefined;
};

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
const fmt = (x: number) => (Number.isNaN(x) ? '-' : x.toFixed(2));

const lines: string[] = [`# ${runLabel} contra ${refLabel}`, ''];
const problems: string[] = [];

lines.push(
  '## Médias por modo',
  '',
  '| Modo | Critério | Referência | Nova | Diferença |',
  '| --- | --- | --- | --- | --- |',
);
for (const mode of MODES) {
  const now = runScores.filter((s) => s.mode === mode && refByKey.has(key(s)));
  if (!now.length) continue;
  for (const c of CRITERIA) {
    const a = mean(now.map((s) => refByKey.get(key(s))[c]));
    const b = mean(now.map((s) => s[c]));
    const d = b - a;
    if (d < -MAX_MEAN_DROP)
      problems.push(`média de ${c} no ${mode} caiu ${fmt(-d)}`);
    lines.push(
      `| ${mode} | ${c} | ${fmt(a)} | ${fmt(b)} | ${d >= 0 ? '+' : ''}${fmt(d)} |`,
    );
  }
}

const review: string[] = [];
lines.push('', '## Perguntas com queda', '');
for (const s of runScores) {
  const r = refByKey.get(key(s));
  if (!r) continue;
  const drops = CRITERIA.filter((c) => r[c] - s[c] >= MAX_QUESTION_DROP);
  const prefersRef =
    (s.pairwise ?? []).filter((p: any) => p.winner === 'ref').length === 2;
  if (drops.length) {
    problems.push(`${key(s)} caiu 2+ em ${drops.join(', ')}`);
    lines.push(
      `- ${key(s)}: ${drops.map((c) => `${c} ${r[c]}→${s[c]}`).join(', ')}`,
    );
  }
  if (drops.length || prefersRef) {
    const newRec = record(runLabel, key(s));
    const refRec = record(refLabel, key(s));
    review.push(
      `## ${key(s)} (${runLabel} contra ${refLabel})`,
      '',
      `Pergunta: ${newRec?.query ?? ''}`,
      '',
      `Motivo: ${[drops.length ? `queda em ${drops.join(', ')}` : '', prefersRef ? 'o juiz preferiu a referência nas duas ordens' : ''].filter(Boolean).join('; ')}`,
      '',
      `Juiz: ${s.notes ?? ''}`,
      '',
      '<table><tr><th>Referência</th><th>Nova</th></tr><tr><td>',
      '',
      visibleAnswer(refRec?.answer ?? ''),
      '',
      '</td><td>',
      '',
      visibleAnswer(newRec?.answer ?? ''),
      '',
      '</td></tr></table>',
      '',
    );
  }
}

const pw = runScores.flatMap((s) => s.pairwise ?? []);
if (pw.length) {
  const count = (w: string) => pw.filter((p: any) => p.winner === w).length;
  lines.push(
    '',
    '## Comparação lado a lado',
    '',
    `Nova venceu ${count('new')}, referência venceu ${count('ref')}, empate ${count('tie')} (de ${pw.length} julgamentos, duas ordens por pergunta).`,
  );
}

let checkRegressions = 0;
for (const s of runScores) {
  const n = record(runLabel, key(s));
  const r = record(refLabel, key(s));
  if (!n || !r) continue;
  const before = runChecks(r, r);
  for (const c of runChecks(n, r)) {
    if (!c.pass && before.find((b) => b.name === c.name)?.pass !== false) {
      checkRegressions++;
      problems.push(`${key(s)} falhou ${c.name}`);
    }
  }
}

const approved = problems.length === 0;
lines.splice(
  2,
  0,
  `**Resultado: ${approved ? 'aprovada' : 'reprovada'}.** ${checkRegressions} regressões nas verificações automáticas.`,
  '',
  ...problems.map((p) => `- ${p}`),
  '',
);

const out = path.join(RUNS, runLabel, `compare-vs-${refLabel}.md`);
fs.writeFileSync(out, lines.join('\n') + '\n');
if (review.length) {
  fs.appendFileSync(
    path.join(EVAL_DIR, 'review-queue.md'),
    review.join('\n') + '\n',
  );
}
console.log(
  `${approved ? 'APROVADA' : 'REPROVADA'}: ${problems.length} problemas. Relatório em ${path.relative(process.cwd(), out)}`,
);
process.exit(approved ? 0 : 1);
