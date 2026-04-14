import z from 'zod';
import { ClassifierInput } from './types';
import { classifierPrompt } from '@/lib/prompts/search/classifier';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';

const schema = z.object({
  classification: z.object({
    skipSearch: z
      .boolean()
      .describe('Indicates whether to skip the search step.'),
    personalSearch: z
      .boolean()
      .describe('Indicates whether to perform a personal search.'),
    academicSearch: z
      .boolean()
      .describe('Indicates whether to perform an academic search.'),
    discussionSearch: z
      .boolean()
      .describe('Indicates whether to perform a discussion search.'),
    showWeatherWidget: z
      .boolean()
      .describe('Indicates whether to show the weather widget.'),
    showStockWidget: z
      .boolean()
      .describe('Indicates whether to show the stock widget.'),
    showCalculationWidget: z
      .boolean()
      .describe('Indicates whether to show the calculation widget.'),
  }),
  standaloneFollowUp: z
    .string()
    .describe(
      "A self-contained, context-independent reformulation of the user's question.",
    ),
});

const shouldForceWebSearch = (query: string) => {
  const normalizedQuery = query.toLowerCase();

  // Queries with strong recency cues should always consult search instead of
  // relying on model pretraining knowledge.
  return (
    /\b(current|latest|today|yesterday|tomorrow|recent|newest|breaking|now)\b/.test(
      normalizedQuery,
    ) ||
    /\bthis\s+(week|month|year)\b/.test(normalizedQuery) ||
    /\bas of\b/.test(normalizedQuery) ||
    /\b20\d{2}\b/.test(normalizedQuery)
  );
};

export const classify = async (input: ClassifierInput) => {
  const output = await input.llm.generateObject<typeof schema>({
    messages: [
      {
        role: 'system',
        content: classifierPrompt,
      },
      {
        role: 'user',
        content: `<conversation_history>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation_history>\n<user_query>\n${input.query}\n</user_query>`,
      },
    ],
    schema,
  });

  const isWidgetOnlyQuery =
    output.classification.showWeatherWidget ||
    output.classification.showStockWidget ||
    output.classification.showCalculationWidget;

  if (
    !isWidgetOnlyQuery &&
    shouldForceWebSearch(output.standaloneFollowUp || input.query)
  ) {
    output.classification.skipSearch = false;
  }

  return output;
};
