'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CheckCircle2,
  Download,
  Loader2,
  Play,
  Square,
  XCircle,
} from 'lucide-react';
import { BENCHMARK_CASES } from '@/lib/benchmark/cases';
import type { BenchmarkReport } from '@/lib/benchmark/report';
import { reportToMarkdown } from '@/lib/benchmark/report';
import { cn } from '@/lib/utils';

type CaseState = {
  status: 'pending' | 'running' | 'done' | 'failed';
  totalMs?: number;
};

const severityStyle: Record<string, string> = {
  bug: 'border-red-500/40 bg-red-500/5',
  gargalo: 'border-amber-500/40 bg-amber-500/5',
  aviso: 'border-yellow-500/30 bg-yellow-500/5',
  sugestao: 'border-light-200 dark:border-dark-200',
};

const download = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

const sec = (ms?: number | null) =>
  ms === null || ms === undefined ? '-' : `${(ms / 1000).toFixed(1)} s`;

const Benchmark = () => {
  const t = useTranslations('Benchmark');
  const [selected, setSelected] = useState<string[]>(
    BENCHMARK_CASES.filter((c) => !c.slow).map((c) => c.id),
  );
  const [states, setStates] = useState<Record<string, CaseState>>({});
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const models = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const chat = {
      providerId: localStorage.getItem('chatModelProviderId') ?? '',
      key: localStorage.getItem('chatModelKey') ?? '',
    };
    const embedding = {
      providerId: localStorage.getItem('embeddingModelProviderId') ?? '',
      key: localStorage.getItem('embeddingModelKey') ?? '',
    };
    return { chat, embedding };
  }, []);
  const modelsReady = !!models?.chat.key && !!models?.embedding.key;

  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );

  const run = async () => {
    if (!models || !modelsReady) return;
    setRunning(true);
    setError(null);
    setReport(null);
    setStates(
      Object.fromEntries(selected.map((id) => [id, { status: 'pending' }])),
    );
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatModel: models.chat,
          embeddingModel: models.embedding,
          cases: selected,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === 'caseStart')
            setStates((s) => ({ ...s, [msg.id]: { status: 'running' } }));
          else if (msg.type === 'caseEnd')
            setStates((s) => ({
              ...s,
              [msg.id]: {
                status: msg.ok ? 'done' : 'failed',
                totalMs: msg.totalMs,
              },
            }));
          else if (msg.type === 'report') setReport(msg.report);
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') setError(String(err?.message ?? err));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const stamp = () =>
    new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6 text-sm text-black/80 dark:text-white/80">
      <section className="space-y-2">
        <p className="text-xs text-black/60 dark:text-white/60">{t('intro')}</p>
        <p className="text-xs">
          {modelsReady ? (
            <>
              {t('usingModels')}: <code>{models!.chat.key}</code> ·{' '}
              <code>{models!.embedding.key}</code>
            </>
          ) : (
            <span className="text-red-500">{t('noModels')}</span>
          )}
        </p>
      </section>

      <section className="space-y-2">
        <h4 className="text-black dark:text-white">{t('cases')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {BENCHMARK_CASES.map((c) => {
            const st = states[c.id];
            return (
              <label
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-light-200 dark:border-dark-200 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  disabled={running}
                  onChange={() => toggle(c.id)}
                />
                <span className="flex-1">
                  {c.label}
                  {c.slow && (
                    <span className="ml-1 text-[11px] text-amber-600">
                      ({t('slow')})
                    </span>
                  )}
                </span>
                {st?.status === 'running' && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                {st?.status === 'done' && (
                  <span className="flex items-center gap-1 text-[11px] text-green-600">
                    <CheckCircle2 size={14} /> {sec(st.totalMs)}
                  </span>
                )}
                {st?.status === 'failed' && (
                  <XCircle size={14} className="text-red-500" />
                )}
              </label>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {!running ? (
          <button
            onClick={run}
            disabled={!modelsReady || selected.length === 0}
            className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-white disabled:opacity-50"
          >
            <Play size={14} /> {t('run')}
          </button>
        ) : (
          <button
            onClick={() => abortRef.current?.abort()}
            className="flex items-center gap-2 rounded-lg border border-light-200 dark:border-dark-200 px-4 py-2"
          >
            <Square size={14} /> {t('stop')}
          </button>
        )}
        {report && (
          <>
            <button
              onClick={() =>
                download(
                  `vane-benchmark-${stamp()}.md`,
                  reportToMarkdown(report),
                  'text/markdown',
                )
              }
              className="flex items-center gap-2 rounded-lg border border-light-200 dark:border-dark-200 px-4 py-2"
            >
              <Download size={14} /> {t('downloadReport')}
            </button>
            <button
              onClick={() =>
                download(
                  `vane-benchmark-${stamp()}.json`,
                  JSON.stringify(report, null, 2),
                  'application/json',
                )
              }
              className="flex items-center gap-2 rounded-lg border border-light-200 dark:border-dark-200 px-4 py-2"
            >
              <Download size={14} /> {t('downloadLog')}
            </button>
          </>
        )}
      </div>
      {running && (
        <p className="text-xs text-black/50 dark:text-white/50">
          {t('runningHint')}
        </p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {report && (
        <>
          <section className="space-y-2">
            <h4 className="text-black dark:text-white">{t('results')}</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-black/50 dark:text-white/50">
                  <tr>
                    <th className="py-1 pr-3">{t('col.case')}</th>
                    <th className="py-1 pr-3">{t('col.total')}</th>
                    <th className="py-1 pr-3">{t('col.firstToken')}</th>
                    <th className="py-1 pr-3">{t('col.model')}</th>
                    <th className="py-1 pr-3">{t('col.embeddings')}</th>
                    <th className="py-1 pr-3">{t('col.search')}</th>
                    <th className="py-1 pr-3">{t('col.pages')}</th>
                    <th className="py-1 pr-3">{t('col.calls')}</th>
                    <th className="py-1 pr-3">{t('col.sources')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-light-200 dark:border-dark-200"
                    >
                      <td className={cn('py-1 pr-3', !r.ok && 'text-red-500')}>
                        {r.label}
                      </td>
                      <td className="py-1 pr-3">{sec(r.totalMs)}</td>
                      <td className="py-1 pr-3">{sec(r.firstTokenMs)}</td>
                      <td className="py-1 pr-3">{sec(r.llmBusyMs)}</td>
                      <td className="py-1 pr-3">
                        {sec(r.embeddingBusyMs)} ({r.embeddingCalls}×)
                      </td>
                      <td className="py-1 pr-3">
                        {sec(r.searchBusyMs)} ({r.searchRequests}×)
                      </td>
                      <td className="py-1 pr-3">
                        {sec(r.pagesBusyMs)} ({r.pageRequests}×)
                      </td>
                      <td className="py-1 pr-3">{r.llmCalls}</td>
                      <td className="py-1 pr-3">{r.sources}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-black/50 dark:text-white/50">
              {t('busyNote')}
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="text-black dark:text-white">{t('findings')}</h4>
            {report.findings.map((f, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-lg border px-3 py-2',
                  severityStyle[f.severity],
                )}
              >
                <p className="font-medium text-black dark:text-white">
                  {t(`severity.${f.severity}`)}: {f.title}
                  {f.cases.length > 0 && (
                    <span className="ml-1 text-[11px] font-normal text-black/50 dark:text-white/50">
                      ({[...new Set(f.cases)].join(', ')})
                    </span>
                  )}
                </p>
                <p className="whitespace-pre-line text-xs">{f.detail}</p>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
};

export default Benchmark;
