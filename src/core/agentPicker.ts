import { z } from 'zod';
import { OpenAI } from '@langchain/openai';
import { RunnableSequence } from '@langchain/core/runnables';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';

const availableAgents = [
  {
    name: 'webSearch',
    description:
      'It is expert is searching the web for information and answer user queries',
  },
  /* {
    name: 'academicSearch',
    description:
      'It is expert is searching the academic databases for information and answer user queries. It is particularly good at finding research papers and articles on topics like science, engineering, and technology. Use this instead of wolframAlphaSearch if the user query is not mathematical or scientific in nature',
  },
  {
    name: 'youtubeSearch',
    description:
      'This model is expert at finding videos on youtube based on user queries',
  },
  {
    name: 'wolframAlphaSearch',
    description:
      'This model is expert at finding answers to mathematical and scientific questions based on user queries.',
  },
  {
    name: 'redditSearch',
    description:
      'This model is expert at finding posts and discussions on reddit based on user queries',
  },
  {
    name: 'writingAssistant',
    description:
      'If there is no need for searching, this model is expert at generating text based on user queries',
  }, */
];

const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    agent: z.string().describe('The name of the selected agent'),
  }),
);

const prompt = `
    You are an AI model who is expert at finding suitable agents for user queries. The available agents are:
    ${availableAgents.map((agent) => `- ${agent.name}: ${agent.description}`).join('\n')}

    Your task is to find the most suitable agent for the following query: {query}

    {format_instructions}
`;

const chain = RunnableSequence.from([
  PromptTemplate.fromTemplate(prompt),
  new OpenAI({ temperature: 0 }),
  parser,
]);

const pickSuitableAgent = async (query: string) => {
  const res = await chain.invoke({
    query,
    format_instructions: parser.getFormatInstructions(),
  });
  return res.agent;
};

export default pickSuitableAgent;
