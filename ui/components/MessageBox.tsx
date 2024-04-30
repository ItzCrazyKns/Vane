/* eslint-disable @next/next/no-img-element */
import React, { MutableRefObject, useEffect, useState } from 'react';
import { Message } from './ChatWindow';
import { cn } from '@/lib/utils';
import {
  BookCopy,
  Disc3,
  FilePen,
  PlusIcon,
  Share,
  ThumbsDown,
  VideoIcon,
} from 'lucide-react';
import Markdown from 'markdown-to-jsx';
import Copy from './MessageActions/Copy';
import Rewrite from './MessageActions/Rewrite';
import MessageSources from './MessageSources';
import SearchImages from './SearchImages';
import SearchVideos from './SearchVideos';

const MessageBox = ({
  message,
  messageIndex,
  history,
  loading,
  dividerRef,
  isLast,
  rewrite,
}: {
  message: Message;
  messageIndex: number;
  history: Message[];
  loading: boolean;
  dividerRef?: MutableRefObject<HTMLDivElement | null>;
  isLast: boolean;
  rewrite: (messageId: string) => void;
}) => {
  const [parsedMessage, setParsedMessage] = useState(message.content);

  useEffect(() => {
    if (
      message.role === 'assistant' &&
      message?.sources &&
      message.sources.length > 0
    ) {
      const regex = /\[(\d+)\]/g;

      return setParsedMessage(
        message.content.replace(
          regex,
          (_, number) =>
            `<a href="${message.sources?.[number - 1]?.metadata?.url}" target="_blank" className="bg-[#1C1C1C] px-1 rounded ml-1 no-underline text-xs text-white/70 relative">${number}</a>`,
        ),
      );
    }
    setParsedMessage(message.content);
  }, [message.content, message.sources, message.role]);

  return (
    <div>
      {message.role === 'user' && (
        <div className={cn('w-full', messageIndex === 0 ? 'pt-16' : 'pt-8')}>
          <h2 className="text-white font-medium text-3xl lg:w-9/12">
            {message.content}
          </h2>
        </div>
      )}

      {message.role === 'assistant' && (
        <div className="flex flex-col space-y-9 lg:space-y-0 lg:flex-row lg:justify-between lg:space-x-9">
          <div
            ref={dividerRef}
            className="flex flex-col space-y-6 w-full lg:w-9/12"
          >
            {message.sources && message.sources.length > 0 && (
              <div className="flex flex-col space-y-2">
                <div className="flex flex-row items-center space-x-2">
                  <BookCopy className="text-white" size={20} />
                  <h3 className="text-white font-medium text-xl">Sources</h3>
                </div>
                <MessageSources sources={message.sources} />
              </div>
            )}
            <div className="flex flex-col space-y-2">
              <div className="flex flex-row items-center space-x-2">
                <Disc3
                  className={cn(
                    'text-white',
                    isLast && loading ? 'animate-spin' : 'animate-none',
                  )}
                  size={20}
                />
                <h3 className="text-white font-medium text-xl">Answer</h3>
              </div>
              <Markdown className="prose max-w-none break-words prose-invert prose-p:leading-relaxed prose-pre:p-0 text-white text-sm md:text-base font-medium">
                {parsedMessage}
              </Markdown>
              {!loading && (
                <div className="flex flex-row items-center justify-between w-full text-white py-4 -mx-2">
                  <div className="flex flex-row items-center space-x-1">
                    <button className="p-2 text-white/70 rounded-xl hover:bg-[#1c1c1c] transition duration-200 hover:text-white">
                      <Share size={18} />
                    </button>
                    <Rewrite rewrite={rewrite} messageId={message.id} />
                  </div>
                  <div className="flex flex-row items-center space-x-1">
                    <Copy initialMessage={message.content} message={message} />
                    <button className="p-2 text-white/70 rounded-xl hover:bg-[#1c1c1c] transition duration-200 hover:text-white">
                      <FilePen size={18} />
                    </button>
                    <button className="p-2 text-white/70 rounded-xl hover:bg-[#1c1c1c] transition duration-200 hover:text-white">
                      <ThumbsDown size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="lg:sticky lg:top-20 flex flex-col items-center space-y-3 w-full lg:w-3/12 z-30 h-full pb-4">
            <SearchImages
              query={history[messageIndex - 1].content}
              chat_history={history.slice(0, messageIndex - 1)}
            />
            <SearchVideos
              chat_history={history.slice(0, messageIndex - 1)}
              query={history[messageIndex - 1].content}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBox;
