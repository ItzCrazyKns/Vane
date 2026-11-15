/* Removes [n] citation markers that point at a source that does not exist. */

/*
  sourceCount is the number of sources the writer was given, numbered
  1..sourceCount. Markers outside that range are removed; grouped markers
  like [1, 9] keep their valid parts ([1]). `removed` lists every number
  taken out, in order of appearance.

  Never changed (found first as protected ranges of the answer):
  - fenced code blocks (``` or ~~~, CommonMark line rules),
  - inline code spans with any number of backticks (`a`, ``a ` b``),
  - inline links, "[text](destination)", text and destination both,
  - reference definitions ("[3]: https://...") and any [n] whose number is
    a defined reference label, since "[text][3]" and "[3]" are then links.
*/

// [1], [12], [1, 2]
const MARKER = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

// A [start, end) span of the answer that must not change.
type Range = [number, number];

/*
  Fenced code blocks. A line starting (after up to 3 spaces) with 3 or more
  backticks or tildes opens a block; it closes only at a line made of at
  least as many of the same character and nothing else. A ``` in the middle
  of a code line does not close it. An unclosed fence runs to the end.
*/
const fencedBlocks = (text: string): Range[] => {
  const ranges: Range[] = [];
  let open: { char: string; len: number; start: number } | null = null;
  let offset = 0;

  for (const line of text.split('\n')) {
    const lineEnd = offset + line.length;
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line);

    if (!open) {
      // A backtick fence's info string may not contain a backtick.
      const info = fence ? line.slice(fence[0].length) : '';
      if (fence && !(fence[1][0] === '`' && info.includes('`'))) {
        open = { char: fence[1][0], len: fence[1].length, start: offset };
      }
    } else if (
      fence &&
      fence[1][0] === open.char &&
      fence[1].length >= open.len &&
      line.slice(fence[0].length).trim() === ''
    ) {
      ranges.push([open.start, lineEnd]);
      open = null;
    }

    offset = lineEnd + 1;
  }

  if (open) ranges.push([open.start, text.length]);
  return ranges;
};

/*
  Inline code spans in text[from, to): a run of N backticks opens a span
  that closes at the next run of exactly N backticks. A run with no
  matching close is literal text.
*/
const inlineCode = (text: string, from: number, to: number): Range[] => {
  const ranges: Range[] = [];
  const run = /`+/g;
  run.lastIndex = from;

  let open: RegExpExecArray | null;
  while ((open = run.exec(text)) && open.index < to) {
    const len = open[0].length;
    const close = new RegExp(`(?<!\`)\`{${len}}(?!\`)`, 'g');
    close.lastIndex = open.index + len;
    const found = close.exec(text);

    if (found && found.index + len <= to) {
      ranges.push([open.index, found.index + len]);
      run.lastIndex = found.index + len;
    }
  }

  return ranges;
};

// "](...)": the end of an inline link's text and its destination
// (one level of nested parens).
const LINK_DESTINATION = /\]\((?:[^()\n]|\([^()\n]*\))*\)/g;
// A reference definition line: "[label]: destination".
const REFERENCE_DEFINITION = /^ {0,3}\[([^\]\n]+)\]:[^\n]*/gm;

const protectedRanges = (
  text: string,
): { ranges: Range[]; referenceLabels: Set<number> } => {
  const code = fencedBlocks(text);

  // Inline code is looked for only between fenced blocks.
  let from = 0;
  for (const [start, end] of [...code]) {
    code.push(...inlineCode(text, from, start));
    from = end;
  }
  code.push(...inlineCode(text, from, text.length));

  const inCode = (i: number) => code.some(([s, e]) => i >= s && i < e);
  const ranges: Range[] = [...code];
  const referenceLabels = new Set<number>();

  for (const m of text.matchAll(LINK_DESTINATION)) {
    const close = m.index ?? 0; // the "]" that ends the link text
    if (inCode(close)) continue;
    // Walk back to the "[" that opens the link text (same line, nested
    // brackets counted), so citations written inside link text stay too.
    let open = close;
    for (let depth = 0, i = close; i >= 0 && text[i] !== '\n'; i--) {
      if (text[i] === ']') depth++;
      else if (text[i] === '[' && --depth === 0) {
        open = i;
        break;
      }
    }
    ranges.push([open, close + m[0].length]);
  }

  for (const m of text.matchAll(REFERENCE_DEFINITION)) {
    const start = m.index ?? 0;
    if (inCode(start)) continue;
    ranges.push([start, start + m[0].length]);
    if (/^\d+$/.test(m[1].trim())) referenceLabels.add(Number(m[1].trim()));
  }

  return { ranges, referenceLabels };
};

export const sanitizeCitations = (
  answer: string,
  sourceCount: number,
): { text: string; removed: number[] } => {
  const removed: number[] = [];
  if (!answer) return { text: answer ?? '', removed };

  const { ranges, referenceLabels } = protectedRanges(answer);
  const isProtected = (i: number) => ranges.some(([s, e]) => i >= s && i < e);

  let out = '';
  let cursor = 0;

  for (const match of answer.matchAll(MARKER)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const next = answer[end] ?? '';

    if (isProtected(start)) continue;
    // [1](url) is a link, not a citation.
    if (next === '(') continue;

    const numbers = match[1].split(',').map((p) => parseInt(p.trim(), 10));
    // [3] with a "[3]: url" definition is a reference link.
    if (numbers.length === 1 && referenceLabels.has(numbers[0])) continue;

    const valid = numbers.filter((n) => n >= 1 && n <= sourceCount);
    const invalid = numbers.filter((n) => !(n >= 1 && n <= sourceCount));

    if (invalid.length === 0) continue;
    removed.push(...invalid);

    out += answer.slice(cursor, start);
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
    if (out === '' || out.endsWith('\n')) {
      while (answer[cursor] === ' ' || answer[cursor] === '\t') cursor++;
    }
  }

  return {
    text: removed.length > 0 ? out + answer.slice(cursor) : answer,
    removed,
  };
};

export default sanitizeCitations;
