import { BaseMessage } from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { StreamEvent } from '@langchain/core/tracers/log_stream';
import eventEmitter from 'events';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import logger from '../utils/logger';
import { IterableReadableStream } from '@langchain/core/utils/stream';

const writingAssistantPrompt = `
You are Perplexica, an AI model who is expert at searching the web and answering user's queries. You are currently set on focus mode 'Writing Assistant', this means you will be helping the user write a response to a given query. 
Since you are a writing assistant, you would not perform web searches. If you think you lack information to answer the query, you can ask the user for more information or suggest them to switch to a different focus mode.
`;

const strParser = new StringOutputParser();

const handleStream = async (
  stream: IterableReadableStream<StreamEvent>,
  emitter: eventEmitter,
) => {
  for await (const event of stream) {
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

const createWritingAssistantChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    ChatPromptTemplate.fromMessages([
      ['system', writingAssistantPrompt],
      new MessagesPlaceholder('chat_history'),
      ['user', '{query}'],
    ]),
    llm,
    strParser,
  ]).withConfig({
    runName: 'FinalResponseGenerator',
  });
};

const handleWritingAssistant = (
  query: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const emitter = new eventEmitter();

  try {
    const writingAssistantChain = createWritingAssistantChain(llm);
    const stream = writingAssistantChain.streamEvents(
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
    logger.error(`Error in writing assistant: ${err}`);
  }

  return emitter;
};

export default handleWritingAssistant;
