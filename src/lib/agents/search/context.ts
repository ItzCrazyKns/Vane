import { Chunk } from '@/lib/types';
import { getTokenCount, truncateTextByTokens } from '@/lib/utils/splitText';

const MAX_TOTAL_SEARCH_CONTEXT_TOKENS = 20000;
const MAX_RESULT_CONTEXT_TOKENS = 2500;
const TRUNCATION_NOTE =
  '\n[Result content truncated to fit the model context window.]';

const escapeAttribute = (value: string) =>
  value.replace(/[<>]/g, '').replace(/"/g, '&quot;');

export const buildSearchResultsContext = (searchFindings: Chunk[] = []) => {
  let remainingTokens = MAX_TOTAL_SEARCH_CONTEXT_TOKENS;
  const contextParts: string[] = [];

  for (const [index, finding] of searchFindings.entries()) {
    if (remainingTokens <= 0) {
      break;
    }

    const title = escapeAttribute(
      String(finding.metadata?.title || `Result ${index + 1}`),
    );
    const prefix = `<result index=${index + 1} title="${title}">`;
    const suffix = `</result>`;
    const wrapperTokens = getTokenCount(prefix) + getTokenCount(suffix);
    const availableContentTokens = Math.min(
      MAX_RESULT_CONTEXT_TOKENS,
      remainingTokens - wrapperTokens,
    );

    if (availableContentTokens <= 0) {
      break;
    }

    const fullContent = String(finding.content || '');
    const fullContentTokens = getTokenCount(fullContent);
    let content = truncateTextByTokens(fullContent, availableContentTokens);

    if (fullContentTokens > availableContentTokens) {
      const noteBudget = Math.max(
        0,
        availableContentTokens - getTokenCount(TRUNCATION_NOTE),
      );
      content = `${truncateTextByTokens(fullContent, noteBudget)}${TRUNCATION_NOTE}`;
    }

    const entry = `${prefix}${content}${suffix}`;
    const entryTokens = getTokenCount(entry);

    if (entryTokens > remainingTokens) {
      break;
    }

    contextParts.push(entry);
    remainingTokens -= entryTokens;
  }

  return contextParts.join('\n');
};
