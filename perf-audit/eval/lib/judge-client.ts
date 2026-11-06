/* OpenAI-compatible client for the judge model (LM Studio by default). */
import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { repairJson } from '@toolsycc/json-repair';

export const judgePrompts = () => {
  const md = fs.readFileSync(
    path.resolve(__dirname, '..', 'judge-prompt.md'),
    'utf-8',
  );
  const section = (name: string) => {
    const m = md.match(new RegExp(`## ${name}\\n([\\s\\S]*?)(\\n## |$)`));
    if (!m) throw new Error(`judge-prompt.md has no "## ${name}" section`);
    return m[1].trim();
  };
  const version = md.match(/versão (\d+)/)?.[1] ?? '?';
  return { rubric: section('rubric'), pairwise: section('pairwise'), version };
};

export const createJudge = () => {
  const model = process.env.EVAL_JUDGE_MODEL;
  if (!model)
    throw new Error('Set EVAL_JUDGE_MODEL (the larger LM Studio model).');
  const client = new OpenAI({
    apiKey:
      process.env.EVAL_JUDGE_API_KEY || process.env.EVAL_API_KEY || 'lm-studio',
    baseURL:
      process.env.EVAL_JUDGE_BASE_URL ||
      process.env.EVAL_BASE_URL ||
      'http://localhost:1234/v1',
  });

  const ask = async <T>(
    system: string,
    user: string,
    schema: object,
  ): Promise<T> => {
    const res = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'grade', schema: schema as any, strict: true },
      },
    });
    const raw = (res.choices[0].message.content ?? '').replace(
      /<think>[\s\S]*?<\/think>/g,
      '',
    );
    try {
      return JSON.parse(raw);
    } catch {
      return JSON.parse(repairJson(raw, { extractJson: true }) as string);
    }
  };

  return { model, ask };
};

export const RUBRIC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'source_relevance',
    'claims',
    'completeness',
    'citation_format',
    'notes',
  ],
  properties: {
    source_relevance: { type: 'integer', minimum: 1, maximum: 5 },
    claims: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['claim', 'cited', 'supported'],
        properties: {
          claim: { type: 'string' },
          cited: { type: 'array', items: { type: 'integer' } },
          supported: { type: 'boolean' },
        },
      },
    },
    completeness: { type: 'integer', minimum: 1, maximum: 5 },
    citation_format: { type: 'integer', minimum: 1, maximum: 5 },
    notes: { type: 'string' },
  },
};

export const PAIRWISE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['winner', 'reason'],
  properties: {
    winner: { type: 'string', enum: ['A', 'B', 'tie'] },
    reason: { type: 'string' },
  },
};
