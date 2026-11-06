/* LLM judge for a saved eval run.

     npx tsx perf-audit/eval/judge.ts --run <label> [--ref <label>]
     npx tsx perf-audit/eval/judge.ts --keypoints --from <label>

   Grades every answer with the fixed rubric in judge-prompt.md (temperature 0)
   and writes runs/<label>/scores.json. With --ref, also compares each answer
   with the reference answer twice, swapping the order to cancel position bias.
   --keypoints drafts perf-audit/eval/keypoints.json from a reference run's
   quality answers; review it by hand before using it. */
import fs from 'node:fs';
import path from 'node:path';
import { EvalRecord, visibleAnswer } from './lib/checks';
import {
  createJudge,
  judgePrompts,
  PAIRWISE_SCHEMA,
  RUBRIC_SCHEMA,
} from './lib/judge-client';

const EVAL_DIR = __dirname;
const RUNS = path.join(EVAL_DIR, 'runs');
const KEYPOINTS = path.join(EVAL_DIR, 'keypoints.json');
const SOURCE_CHARS = 1200;
const MAX_SOURCES = 30;

const args = process.argv.slice(2);
const get = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const loadRun = (label: string): EvalRecord[] =>
  fs
    .readdirSync(path.join(RUNS, label))
    .filter((f) => /^[A-F]\d\d\.(speed|balanced|quality)\.json$/.test(f))
    .sort()
    .map((f) =>
      JSON.parse(fs.readFileSync(path.join(RUNS, label, f), 'utf-8')),
    );

const formatSources = (rec: EvalRecord) =>
  rec.sources.length === 0
    ? '(no sources: search was skipped)'
    : rec.sources
        .slice(0, MAX_SOURCES)
        .map(
          (s, i) =>
            `[${i + 1}] ${s.title ?? ''} ${s.url ?? ''}\n${(s.content ?? '').slice(0, SOURCE_CHARS)}`,
        )
        .join('\n\n');

const main = async () => {
  const judge = createJudge();
  const prompts = judgePrompts();

  if (args.includes('--keypoints')) {
    const from = get('from');
    if (!from) throw new Error('--keypoints needs --from <label>');
    const out: Record<string, string[]> = {};
    for (const rec of loadRun(from).filter((r) => r.mode === 'quality')) {
      const res = await judge.ask<{ points: string[] }>(
        'List the 3 to 6 key points a complete answer to the question must cover, based on the reference answer. Each point is one short sentence in the language of the question. Leave out style and citation details.',
        `Question: ${rec.query}\n\nReference answer:\n${visibleAnswer(rec.answer)}`,
        {
          type: 'object',
          additionalProperties: false,
          required: ['points'],
          properties: { points: { type: 'array', items: { type: 'string' } } },
        },
      );
      out[rec.id] = res.points;
      console.log(rec.id, res.points.length, 'pontos');
    }
    fs.writeFileSync(
      KEYPOINTS,
      JSON.stringify(
        { reviewed: false, from, judge: judge.model, points: out },
        null,
        2,
      ),
    );
    return;
  }

  const runLabel = get('run');
  if (!runLabel) throw new Error('--run <label> is required');
  const refLabel = get('ref');
  const keypoints: Record<string, string[]> = fs.existsSync(KEYPOINTS)
    ? JSON.parse(fs.readFileSync(KEYPOINTS, 'utf-8')).points
    : {};
  const ref = refLabel
    ? new Map(loadRun(refLabel).map((r) => [`${r.id}.${r.mode}`, r]))
    : undefined;

  const scores: any[] = [];
  for (const rec of loadRun(runLabel)) {
    const answer = visibleAnswer(rec.answer);
    const points = keypoints[rec.id] ?? [];
    const grade = await judge.ask<any>(
      prompts.rubric,
      `Question: ${rec.query}\n\nSources:\n${formatSources(rec)}\n\nKey points:\n${
        points.length ? points.map((p) => `- ${p}`).join('\n') : '(none given)'
      }\n\nAnswer:\n${answer}`,
      RUBRIC_SCHEMA,
    );
    const claims: any[] = grade.claims ?? [];
    const supported = claims.filter((c) => c.supported).length;
    const grounding = claims.length
      ? 1 + 4 * (supported / claims.length)
      : rec.sources.length === 0
        ? 5
        : 1;

    const entry: any = {
      id: rec.id,
      mode: rec.mode,
      relevance: grade.source_relevance,
      grounding: Math.round(grounding * 100) / 100,
      completeness: grade.completeness,
      citationFormat: grade.citation_format,
      claims,
      notes: grade.notes,
    };

    const refRec = ref?.get(`${rec.id}.${rec.mode}`);
    if (refRec) {
      const ask = (a: string, b: string) =>
        judge.ask<{ winner: 'A' | 'B' | 'tie'; reason: string }>(
          prompts.pairwise,
          `Question: ${rec.query}\n\nSources:\n${formatSources(refRec)}\n\nAnswer A:\n${a}\n\nAnswer B:\n${b}`,
          PAIRWISE_SCHEMA,
        );
      const refAnswer = visibleAnswer(refRec.answer);
      const first = await ask(answer, refAnswer); // new = A
      const second = await ask(refAnswer, answer); // new = B
      const asNew = (w: string, newIs: 'A' | 'B') =>
        w === 'tie' ? 'tie' : w === newIs ? 'new' : 'ref';
      entry.pairwise = [
        {
          order: 'new-first',
          winner: asNew(first.winner, 'A'),
          reason: first.reason,
        },
        {
          order: 'ref-first',
          winner: asNew(second.winner, 'B'),
          reason: second.reason,
        },
      ];
    }

    scores.push(entry);
    console.log(
      `${rec.id} ${rec.mode.padEnd(8)} rel=${entry.relevance} fund=${entry.grounding} comp=${entry.completeness} cit=${entry.citationFormat}`,
    );
  }

  fs.writeFileSync(
    path.join(
      RUNS,
      runLabel,
      refLabel ? `scores-vs-${refLabel}.json` : 'scores.json',
    ),
    JSON.stringify(
      {
        judge: judge.model,
        promptVersion: prompts.version,
        ref: refLabel ?? null,
        scores,
      },
      null,
      2,
    ),
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
