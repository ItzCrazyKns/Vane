// @vitest-environment jsdom
/**
 * Durante o streaming o useChat recria todas as `sections` a cada token, então
 * todo MessageBox re-renderiza. O que custa caro é o markdown: este teste conta
 * quantas vezes o <Markdown> de cada mensagem renderiza enquanto só a última
 * recebe tokens. Mensagens já terminadas não devem ser re-parseadas.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { Section } from '@/lib/hooks/useChat';

const markdownRenders = new Map<string, number>();

vi.mock('markdown-to-jsx', async (importOriginal) => {
  const actual: any = await importOriginal();
  const Real = actual.default;
  const Counting = (props: { children: string }) => {
    markdownRenders.set(
      props.children,
      (markdownRenders.get(props.children) ?? 0) + 1,
    );
    return React.createElement(Real, props);
  };
  return { ...actual, default: Counting };
});

const chat = vi.hoisted(() => ({ ctx: {} as Record<string, unknown> }));
vi.mock('@/lib/hooks/useChat', () => ({ useChat: () => chat.ctx }));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('react-text-to-speech', () => ({
  useSpeech: () => ({ speechStatus: 'stopped', start() {}, stop() {} }),
}));
vi.mock('@/components/SearchImages', () => ({ default: () => null }));
vi.mock('@/components/SearchVideos', () => ({ default: () => null }));

import MessageBox from '@/components/MessageBox';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const LONG_ANSWER = Array.from(
  { length: 12 },
  (_, i) =>
    `## Seção ${i}\n\nParágrafo com **negrito**, _itálico_ e uma citação <citation href="https://example.com/${i}">${i + 1}</citation>.\n\n- item a\n- item b\n\n| a | b |\n|---|---|\n| 1 | 2 |`,
).join('\n\n');

const makeMessage = (id: string, text: string, status: string) => ({
  messageId: id,
  chatId: 'c',
  createdAt: new Date(0),
  backendId: id,
  query: `pergunta ${id}`,
  status,
  responseBlocks: [{ id: `t-${id}`, type: 'text', data: text }],
});

// Igual ao useMemo de useChat: um objeto Section novo para cada mensagem.
const toSections = (messages: any[]): Section[] =>
  messages.map((message) => ({
    message,
    widgets: [],
    parsedTextBlocks: [message.responseBlocks[0].data],
    speechMessage: '',
    thinkingEnded: true,
    suggestions: [],
  }));

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  markdownRenders.clear();
});

const streamTokens = (finished: number, tokens: number) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  const done = Array.from({ length: finished }, (_, i) =>
    makeMessage(`m${i}`, `${LONG_ANSWER}\n\nresposta ${i}`, 'completed'),
  );
  let streamed = 'Início';

  const renderAll = () => {
    const messages = [...done, makeMessage('last', streamed, 'answering')];
    const sections = toSections(messages);
    // O provider recria estas funções a cada render.
    chat.ctx = {
      loading: true,
      researchEnded: true,
      messages,
      sections,
      chatHistory: [],
      sendMessage: () => {},
      rewrite: () => {},
    };
    root!.render(
      React.createElement(
        React.Fragment,
        null,
        sections.map((section, i) =>
          React.createElement(MessageBox, {
            key: section.message.messageId,
            section,
            sectionIndex: i,
            isLast: i === sections.length - 1,
          }),
        ),
      ),
    );
  };

  act(renderAll);
  const start = performance.now();
  for (let i = 0; i < tokens; i++) {
    streamed += ` token${i}`;
    act(renderAll);
  }
  const ms = performance.now() - start;

  const finishedRenders = done.map(
    (m) => markdownRenders.get(m.responseBlocks[0].data) ?? 0,
  );
  return { finishedRenders, ms, text: container.textContent ?? '' };
};

describe('MessageBox durante o streaming', () => {
  it('não re-renderiza o markdown de mensagens já terminadas', () => {
    const { finishedRenders, ms, text } = streamTokens(5, 40);
    console.log(
      `[render] markdown renders das 5 mensagens terminadas após 40 tokens: ${finishedRenders.join(',')} (${ms.toFixed(0)} ms)`,
    );
    for (const n of finishedRenders) expect(n).toBe(1);
    // A mensagem em streaming continua sendo atualizada.
    expect(text).toContain('token39');
    expect(text).toContain('resposta 4');
  });
});
