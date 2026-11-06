import { Chunk } from '../types';

/* Fenced blocks (closed or still streaming) and inline code spans. */
const CODE_SEGMENTS = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/;
/* [n] or [n, m, ...] that is not the text of a markdown link. */
const NUMERIC_CITATION = /(\s?)\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g;

/**
 * Removes citation numbers the writer could not have meant: [n] with n
 * above `sourceCount`, the number of sources it was given (upstream
 * #1227). Valid citations are left exactly as written; a group with some
 * invalid numbers keeps the valid ones ("[1, 7, 2]" -> "[1, 2]"); a group
 * left empty is removed with the space before it. Code spans, fenced
 * blocks and markdown links are not touched.
 */
export const sanitizeCitations = (text: string, sourceCount: number) =>
  text
    .split(CODE_SEGMENTS)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(NUMERIC_CITATION, (match, space: string, list) => {
            const numbers: string[] = list
              .split(',')
              .map((n: string) => n.trim());
            const valid = numbers.filter((n) => Number(n) <= sourceCount);
            if (valid.length === numbers.length) return match;
            if (valid.length === 0) return '';
            return `${space}[${valid.join(', ')}]`;
          }),
    )
    .join('');

/* Turns a text block from the writer into what the message renderer shows:
   [n] and [n, m] become <citation> links to the matching source, and an
   unclosed <think> tag is closed. Moved out of useChat unchanged so it can
   be tested. */
export const processTextBlock = (data: string, sources: Chunk[]) => {
  let processedText = data;
  let speech = '';
  let thinkingEnded = false;
  const citationRegex = /\[([^\]]+)\]/g;
  const regex = /\[(\d+)\]/g;

  if (processedText.includes('<think>')) {
    const openThinkTag = processedText.match(/<think>/g)?.length || 0;
    const closeThinkTag = processedText.match(/<\/think>/g)?.length || 0;

    if (openThinkTag && !closeThinkTag) {
      processedText += '</think> <a> </a>';
    }
  }

  if (data.includes('</think>')) {
    thinkingEnded = true;
  }

  if (sources.length > 0) {
    processedText = processedText.replace(
      citationRegex,
      (_, capturedContent: string) => {
        const numbers = capturedContent
          .split(',')
          .map((numStr) => numStr.trim());

        const linksHtml = numbers
          .map((numStr) => {
            const number = parseInt(numStr);

            if (isNaN(number) || number <= 0) {
              return `[${numStr}]`;
            }

            const source = sources[number - 1];
            const url = source?.metadata?.url;

            if (url) {
              return `<citation href="${url}">${numStr}</citation>`;
            } else {
              return ``;
            }
          })
          .join('');

        return linksHtml;
      },
    );
    speech = data.replace(regex, '');
  } else {
    processedText = processedText.replace(regex, '');
    speech = data.replace(regex, '');
  }

  return { text: processedText, speech, thinkingEnded };
};
