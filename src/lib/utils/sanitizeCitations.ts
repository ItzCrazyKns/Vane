/* Removes [n] citation markers that point at a source that does not exist. */

/*
  sourceCount is the number of sources the writer was given, numbered 1..sourceCount.
  Markers outside that range are removed; grouped markers like [1, 9] keep their
  valid parts ([1]). Fenced code blocks, inline code and markdown links are left
  alone. `removed` lists every number taken out, in order of appearance.
*/

// [1], [12], [1, 2]
const MARKER = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

// Splits text into code (```...``` / ~~~...~~~ fences, `inline`) and prose parts.
// Odd indexes of the result are code and are never changed.
const CODE = /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/g;

const sanitizeProse = (
  text: string,
  sourceCount: number,
  removed: number[],
  atLineStart: boolean, // true when this part begins a line of the answer
): string => {
  let out = '';
  let cursor = 0;

  for (const match of text.matchAll(MARKER)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const next = text[end] ?? '';
    const prev = text[start - 1] ?? '\n';

    // Skip markdown links: [1](url) and reference definitions "[1]: url".
    if (next === '(' || (next === ':' && prev === '\n')) continue;

    const numbers = match[1].split(',').map((p) => parseInt(p.trim(), 10));
    const valid = numbers.filter((n) => n >= 1 && n <= sourceCount);
    const invalid = numbers.filter((n) => !(n >= 1 && n <= sourceCount));

    if (invalid.length === 0) continue;
    removed.push(...invalid);

    out += text.slice(cursor, start);
    cursor = end;

    if (valid.length > 0) {
      out += `[${valid.join(', ')}]`;
      continue;
    }

    // The whole marker is gone. Tidy the spaces it leaves behind:
    // "word [9]." -> "word."   "word [9] next" -> "word next"
    if (next === '' || /[\s.,;:!?)]/.test(next)) {
      out = out.replace(/[ \t]+$/, '');
    }
    // At the start of a line, also drop the spaces that followed the marker.
    if ((out === '' && atLineStart) || out.endsWith('\n')) {
      while (text[cursor] === ' ' || text[cursor] === '\t') cursor++;
    }
  }

  return out + text.slice(cursor);
};

export const sanitizeCitations = (
  answer: string,
  sourceCount: number,
): { text: string; removed: number[] } => {
  const removed: number[] = [];
  if (!answer) return { text: answer ?? '', removed };

  const parts = answer.split(CODE);
  const text = parts
    .map((part, i) =>
      i % 2 === 1
        ? part
        : sanitizeProse(
            part,
            sourceCount,
            removed,
            i === 0 || parts[i - 1].endsWith('\n'),
          ),
    )
    .join('');

  return { text: removed.length > 0 ? text : answer, removed };
};

export default sanitizeCitations;
