import z from 'zod';
import { ResearchAction } from '../../types';

const schema = z.object({
  plan: z
    .string()
    .describe(
      'A concise natural-language plan in one short paragraph. Open with a short intent phrase (e.g., "Okay, the user wants to...", "Searching for...", "Looking into...") and lay out the steps you will take. Write it in the same language as the user\'s question.',
    ),
});

const actionDescription = `
Use this tool FIRST on every turn to state your plan in natural language before any other action. Keep it short, action-focused, and tailored to the current query.
Make sure to not include reference to any tools or actions you might take, just the plan itself. The user isn't aware about tools, but they love to see your thought process.

Here are some examples of good plans:
<examples>
- "Okay, the user wants to know the latest advancements in renewable energy. I will start by looking for recent articles and studies on this topic, then summarize the key points." -> "I have gathered enough information to provide a comprehensive answer."
- "The user is asking about the health benefits of a Mediterranean diet. I will search for scientific studies and expert opinions on this diet, then compile the findings into a clear summary." -> "I have gathered information about the Mediterranean diet and its health benefits, I will now look up for any recent studies to ensure the information is current."
</examples>

YOU CAN NEVER CALL ANY OTHER TOOL BEFORE CALLING THIS ONE FIRST, IF YOU DO, THAT CALL WOULD BE IGNORED.
`;

const planAction: ResearchAction<typeof schema> = {
  name: '__reasoning_preamble',
  schema: schema,
  getToolDescription: () =>
    'Use this FIRST on every turn to state your plan in natural language before any other action. Keep it short, action-focused, and tailored to the current query.',
  getDescription: () => actionDescription,
  enabled: (config) => config.mode !== 'speed',
  execute: async (input, _) => {
    return {
      type: 'reasoning',
      reasoning: input.plan,
    };
  },
};

export default planAction;
