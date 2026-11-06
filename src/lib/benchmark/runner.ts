import BaseLLM from '@/lib/models/base/llm';
import BaseEmbedding from '@/lib/models/base/embedding';
import SessionManager from '@/lib/session';
import APISearchAgent from '@/lib/agents/search/api';
import searchImages from '@/lib/agents/media/image';
import searchVideos from '@/lib/agents/media/video';
import { ChatTurnMessage } from '@/lib/types';
import { BenchmarkCase } from './cases';
import {
  EmbeddingCallStat,
  HttpStat,
  InstrumentedEmbedding,
  InstrumentedLLM,
  LLMCallStat,
  newRecorder,
  withHttpTrace,
} from './instrument';

export type CaseResult = {
  id: string;
  label: string;
  kind: BenchmarkCase['kind'];
  mode?: string;
  query: string;
  expectSkipSearch: boolean;
  ok: boolean;
  error?: string;
  timing: {
    totalMs: number;
    researchDoneMs: number | null;
    firstTokenMs: number | null;
  };
  answer: string;
  sources: { title: string; url: string }[];
  resultCount: number;
  llm: LLMCallStat[];
  embedding: EmbeddingCallStat[];
  http: HttpStat[];
};

const toHistory = (h?: [string, string][]): ChatTurnMessage[] =>
  (h ?? []).map(([role, content]) => ({
    role: role === 'human' ? 'user' : 'assistant',
    content,
  }));

export const runCase = async (
  c: BenchmarkCase,
  models: { llm: BaseLLM<any>; embedding: BaseEmbedding<any> },
  urls: { searxng?: string; firecrawl?: string },
): Promise<CaseResult> => {
  const rec = newRecorder();
  const llm = new InstrumentedLLM(models.llm, rec);
  const embedding = new InstrumentedEmbedding(models.embedding, rec);
  const now = () => Math.round(performance.now() - rec.t0);

  const result: CaseResult = {
    id: c.id,
    label: c.label,
    kind: c.kind,
    mode: c.mode,
    query: c.query,
    expectSkipSearch: c.expectSkipSearch ?? false,
    ok: true,
    timing: { totalMs: 0, researchDoneMs: null, firstTokenMs: null },
    answer: '',
    sources: [],
    resultCount: 0,
    llm: rec.llm,
    embedding: rec.embedding,
    http: rec.http,
  };

  try {
    await withHttpTrace(rec, urls, async () => {
      if (c.kind === 'images' || c.kind === 'videos') {
        const fn = c.kind === 'images' ? searchImages : searchVideos;
        const out = await fn(
          { query: c.query, chatHistory: toHistory(c.history) },
          llm,
        );
        result.resultCount = out.length;
        return;
      }

      const session = SessionManager.createSession();
      const done = new Promise<void>((resolve, reject) => {
        session.subscribe((event: string, data: any) => {
          if (event === 'data') {
            if (data.type === 'searchResults') {
              result.sources = (data.data ?? []).map((s: any) => ({
                title: String(s.metadata?.title ?? ''),
                url: String(s.metadata?.url ?? ''),
              }));
              result.resultCount = result.sources.length;
            } else if (data.type === 'researchComplete') {
              result.timing.researchDoneMs = now();
            } else if (data.type === 'response') {
              if (result.timing.firstTokenMs === null)
                result.timing.firstTokenMs = now();
              result.answer += data.data;
            }
          } else if (event === 'end') {
            resolve();
          } else if (event === 'error') {
            reject(
              new Error(typeof data === 'string' ? data : JSON.stringify(data)),
            );
          }
        });
      });

      await new APISearchAgent().searchAsync(session, {
        chatHistory: toHistory(c.history),
        followUp: c.query,
        config: {
          llm,
          embedding,
          sources: c.sources ?? ['web'],
          mode: c.mode ?? 'speed',
          fileIds: [],
          systemInstructions: '',
        },
        chatId: crypto.randomUUID(),
        messageId: crypto.randomUUID(),
      });
      await done;
    });
  } catch (err: any) {
    result.ok = false;
    result.error = String(err?.message ?? err).slice(0, 500);
  }

  result.timing.totalMs = now();
  return result;
};
