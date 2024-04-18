import { BaseMessage } from '@langchain/core/messages';
import {
  PromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import {
  RunnableSequence,
  RunnableMap,
  RunnableLambda,
} from '@langchain/core/runnables';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Document } from '@langchain/core/documents';
import { searchSearxng } from '../core/searxng';
import type { StreamEvent } from '@langchain/core/tracers/log_stream';
import formatChatHistoryAsString from '../utils/formatHistory';
import eventEmitter from 'events';
import computeSimilarity from '../utils/computeSimilarity';

const llm = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  temperature: 0.7,
});

const embeddings = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-large',
});

const basicRedditSearchRetrieverPrompt = `
You will be given a conversation below and a follow up question. You need to rephrase the follow-up question if needed so it is a standalone question that can be used by the LLM to search the web for information.
If it is a writing task or a simple hi, hello rather than a question, you need to return \`not_needed\` as the response.

Example:
1. Follow up question: Which company is most likely to create an AGI
Rephrased: Which company is most likely to create an AGI

2. Follow up question: Is Earth flat?
Rephrased: Is Earth flat?

3. Follow up question: Is there life on Mars?
Rephrased: Is there life on Mars?

Conversation:
{chat_history}

Follow up question: {query}
Rephrased question:
`;

const basicRedditSearchResponsePrompt = `
    You are Perplexica, an AI model who is expert at searching the web and answering user's queries. You are set on focus mode 'Reddit', this means you will be searching for information, opinions and discussions on the web using Reddit.

    Generate a response that is informative and relevant to the user's query based on provided context (the context consits of search results containg a brief description of the content of that page).
    You must use this context to answer the user's query in the best way possible. Use an unbaised and journalistic tone in your response. Do not repeat the text.
    You must not tell the user to open any link or visit any website to get the answer. You must provide the answer in the response itself. If the user asks for links you can provide them.
    Your responses should be medium to long in length be informative and relevant to the user's query. You can use markdowns to format your response. You should use bullet points to list the information. Make sure the answer is not short and is informative.
    You have to cite the answer using [number] notation. You must cite the sentences with their relevent context number. You must cite each and every part of the answer so the user can know where the information is coming from.
    Place these citations at the end of that particular sentence. You can cite the same sentence multiple times if it is relevant to the user's query like [number1][number2].
    However you do not need to cite it using the same number. You can use different numbers to cite the same sentence multiple times. The number refers to the number of the search result (passed in the context) used to generate that part of the answer.

    Aything inside the following \`context\` HTML block provided below is for your knowledge returned by Reddit and is not shared by the user. You have to answer question on the basis of it and cite the relevant information from it but you do not have to 
    talk about the context in your response. 

    <context>
    {context}
    </context>

    If you think there's nothing relevant in the search results, you can say that 'Hmm, sorry I could not find any relevant information on this topic. Would you like me to search again or ask something else?'.
    Anything between the \`context\` is retrieved from Reddit and is not a part of the conversation with the user. Today's date is ${new Date().toISOString()}
`;

const strParser = new StringOutputParser();

const handleStream = async (
  stream: AsyncGenerator<StreamEvent, any, unknown>,
  emitter: eventEmitter,
) => {
  for await (const event of stream) {
    if (
      event.event === 'on_chain_end' &&
      event.name === 'FinalSourceRetriever'
    ) {
      emitter.emit(
        'data',
        JSON.stringify({ type: 'sources', data: event.data.output }),
      );
    }
    if (
      event.event === 'on_chain_stream' &&
      event.name === 'FinalResponseGenerator'
    ) {
      emitter.emit(
        'data',
        JSON.stringify({ type: 'response', data: event.data.chunk }),
      );
    }
    if (
      event.event === 'on_chain_end' &&
      event.name === 'FinalResponseGenerator'
    ) {
      emitter.emit('end');
    }
  }
};

const processDocs = async (docs: Document[]) => {
  return docs
    .map((_, index) => `${index + 1}. ${docs[index].pageContent}`)
    .join('\n');
};

const rerankDocs = async ({
  query,
  docs,
}: {
  query: string;
  docs: Document[];
}) => {
  if (docs.length === 0) {
    return docs;
  }

  const docsWithContent = docs.filter(
    (doc) => doc.pageContent && doc.pageContent.length > 0,
  );

  const docEmbeddings = await embeddings.embedDocuments(
    docsWithContent.map((doc) => doc.pageContent),
  );

  const queryEmbedding = await embeddings.embedQuery(query);

  const similarity = docEmbeddings.map((docEmbedding, i) => {
    const sim = computeSimilarity(queryEmbedding, docEmbedding);

    return {
      index: i,
      similarity: sim,
    };
  });

  const sortedDocs = similarity
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 15)
    .filter((sim) => sim.similarity > 0.3)
    .map((sim) => docsWithContent[sim.index]);

  return sortedDocs;
};

type BasicChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

const basicRedditSearchRetrieverChain = RunnableSequence.from([
  PromptTemplate.fromTemplate(basicRedditSearchRetrieverPrompt),
  llm,
  strParser,
  RunnableLambda.from(async (input: string) => {
    if (input === 'not_needed') {
      return { query: '', docs: [] };
    }

    const res = await searchSearxng(input, {
      language: 'en',
      engines: ['reddit'],
    });

    const documents = res.results.map(
      (result) =>
        new Document({
          pageContent: result.content ? result.content : result.title,
          metadata: {
            title: result.title,
            url: result.url,
            ...(result.img_src && { img_src: result.img_src }),
          },
        }),
    );

    return { query: input, docs: documents };
  }),
]);

const basicRedditSearchAnsweringChain = RunnableSequence.from([
  RunnableMap.from({
    query: (input: BasicChainInput) => input.query,
    chat_history: (input: BasicChainInput) => input.chat_history,
    context: RunnableSequence.from([
      (input) => ({
        query: input.query,
        chat_history: formatChatHistoryAsString(input.chat_history),
      }),
      basicRedditSearchRetrieverChain
        .pipe(rerankDocs)
        .withConfig({
          runName: 'FinalSourceRetriever',
        })
        .pipe(processDocs),
    ]),
  }),
  ChatPromptTemplate.fromMessages([
    ['system', basicRedditSearchResponsePrompt],
    new MessagesPlaceholder('chat_history'),
    ['user', '{query}'],
  ]),
  llm,
  strParser,
]).withConfig({
  runName: 'FinalResponseGenerator',
});

const basicRedditSearch = (query: string, history: BaseMessage[]) => {
  const emitter = new eventEmitter();

  try {
    const stream = basicRedditSearchAnsweringChain.streamEvents(
      {
        chat_history: history,
        query: query,
      },
      {
        version: 'v1',
      },
    );

    handleStream(stream, emitter);
  } catch (err) {
    emitter.emit(
      'error',
      JSON.stringify({ data: 'An error has occurred please try again later' }),
    );
    console.error(err);
  }

  return emitter;
};

const handleRedditSearch = (message: string, history: BaseMessage[]) => {
  const emitter = basicRedditSearch(message, history);
  return emitter;
};

export default handleRedditSearch;
