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
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Document } from '@langchain/core/documents';
import { searchSearxng } from '../lib/searxng';
import type { StreamEvent } from '@langchain/core/tracers/log_stream';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import formatChatHistoryAsString from '../utils/formatHistory';
import eventEmitter from 'events';
import logger from '../utils/logger';
import { IterableReadableStream } from '@langchain/core/utils/stream';

const basicWolframAlphaSearchRetrieverPrompt = `
You will be given a conversation below and a follow up question. You need to rephrase the follow-up question if needed so it is a standalone question that can be used by the LLM to search the web for information.
If it is a writing task or a simple hi, hello rather than a question, you need to return \`not_needed\` as the response.

Example:
1. Follow up question: What is the atomic radius of S?
Rephrased: Atomic radius of S

2. Follow up question: What is linear algebra?
Rephrased: Linear algebra

3. Follow up question: What is the third law of thermodynamics?
Rephrased: Third law of thermodynamics

Conversation:
{chat_history}

Follow up question: {query}
Rephrased question:
`;

const basicWolframAlphaSearchResponsePrompt = `
    You are Perplexica, an AI model who is expert at searching the web and answering user's queries. You are set on focus mode 'Wolfram Alpha', this means you will be searching for information on the web using Wolfram Alpha. It is a computational knowledge engine that can answer factual queries and perform computations.

    Generate a response that is informative and relevant to the user's query based on provided context (the context consits of search results containing a brief description of the content of that page).
    You must use this context to answer the user's query in the best way possible. Use an unbaised and journalistic tone in your response. Do not repeat the text.
    You must not tell the user to open any link or visit any website to get the answer. You must provide the answer in the response itself. If the user asks for links you can provide them.
    Your responses should be medium to long in length be informative and relevant to the user's query. You can use markdowns to format your response. You should use bullet points to list the information. Make sure the answer is not short and is informative.
    You have to cite the answer using [number] notation. You must cite the sentences with their relevent context number. You must cite each and every part of the answer so the user can know where the information is coming from.
    Place these citations at the end of that particular sentence. You can cite the same sentence multiple times if it is relevant to the user's query like [number1][number2].
    However you do not need to cite it using the same number. You can use different numbers to cite the same sentence multiple times. The number refers to the number of the search result (passed in the context) used to generate that part of the answer.

    Anything inside the following \`context\` HTML block provided below is for your knowledge returned by Wolfram Alpha and is not shared by the user. You have to answer question on the basis of it and cite the relevant information from it but you do not have to 
    talk about the context in your response. 

    <context>
    {context}
    </context>

    If you think there's nothing relevant in the search results, you can say that 'Hmm, sorry I could not find any relevant information on this topic. Would you like me to search again or ask something else?'.
    Anything between the \`context\` is retrieved from Wolfram Alpha and is not a part of the conversation with the user. Today's date is ${new Date().toISOString()}
`;

const strParser = new StringOutputParser();

const handleStream = async (
  stream: IterableReadableStream<StreamEvent>,
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

type BasicChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

const createBasicWolframAlphaSearchRetrieverChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    PromptTemplate.fromTemplate(basicWolframAlphaSearchRetrieverPrompt),
    llm,
    strParser,
    RunnableLambda.from(async (input: string) => {
      if (input === 'not_needed') {
        return { query: '', docs: [] };
      }

      const res = await searchSearxng(input, {
        language: 'en',
        engines: ['wolframalpha'],
      });

      const documents = res.results.map(
        (result) =>
          new Document({
            pageContent: result.content,
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
};

const createBasicWolframAlphaSearchAnsweringChain = (llm: BaseChatModel) => {
  const basicWolframAlphaSearchRetrieverChain =
    createBasicWolframAlphaSearchRetrieverChain(llm);

  const processDocs = (docs: Document[]) => {
    return docs
      .map((_, index) => `${index + 1}. ${docs[index].pageContent}`)
      .join('\n');
  };

  return RunnableSequence.from([
    RunnableMap.from({
      query: (input: BasicChainInput) => input.query,
      chat_history: (input: BasicChainInput) => input.chat_history,
      context: RunnableSequence.from([
        (input) => ({
          query: input.query,
          chat_history: formatChatHistoryAsString(input.chat_history),
        }),
        basicWolframAlphaSearchRetrieverChain
          .pipe(({ query, docs }) => {
            return docs;
          })
          .withConfig({
            runName: 'FinalSourceRetriever',
          })
          .pipe(processDocs),
      ]),
    }),
    ChatPromptTemplate.fromMessages([
      ['system', basicWolframAlphaSearchResponsePrompt],
      new MessagesPlaceholder('chat_history'),
      ['user', '{query}'],
    ]),
    llm,
    strParser,
  ]).withConfig({
    runName: 'FinalResponseGenerator',
  });
};

const basicWolframAlphaSearch = (
  query: string,
  history: BaseMessage[],
  llm: BaseChatModel,
) => {
  const emitter = new eventEmitter();

  try {
    const basicWolframAlphaSearchAnsweringChain =
      createBasicWolframAlphaSearchAnsweringChain(llm);
    const stream = basicWolframAlphaSearchAnsweringChain.streamEvents(
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
    logger.error(`Error in WolframAlphaSearch: ${err}`);
  }

  return emitter;
};

const handleWolframAlphaSearch = (
  message: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const emitter = basicWolframAlphaSearch(message, history, llm);
  return emitter;
};

export default handleWolframAlphaSearch;
