import { Chunk } from '../types';

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
