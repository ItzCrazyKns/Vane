'use client';

import {
  AssistantMessage,
  ChatTurn,
  Message,
  SourceMessage,
  SuggestionMessage,
  UserMessage,
} from '@/components/ChatWindow';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import crypto from 'crypto';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';
import { MinimalProvider } from '../models/types';

export type Section = {
  userMessage: UserMessage;
  assistantMessage: AssistantMessage | undefined;
  parsedAssistantMessage: string | undefined;
  speechMessage: string | undefined;
  sourceMessage: SourceMessage | undefined;
  thinkingEnded: boolean;
  suggestions?: string[];
};

type ChatContext = {
  messages: Message[];
  chatTurns: ChatTurn[];
  sections: Section[];
  chatHistory: [string, string][];
  files: File[];
  fileIds: string[];
  focusMode: string;
  chatId: string | undefined;
  optimizationMode: string;
  isMessagesLoaded: boolean;
  loading: boolean;
  notFound: boolean;
  messageAppeared: boolean;
  isReady: boolean;
  hasError: boolean;
  setOptimizationMode: (mode: string) => void;
  setFocusMode: (mode: string) => void;
  setFiles: (files: File[]) => void;
  setFileIds: (fileIds: string[]) => void;
  sendMessage: (
    message: string,
    messageId?: string,
    rewrite?: boolean,
  ) => Promise<void>;
  rewrite: (messageId: string) => void;
};

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

interface ChatModelProvider {
  key: string;
  providerId: string;
}

interface EmbeddingModelProvider {
  key: string;
  providerId: string;
}

const checkConfig = async (
  setChatModelProvider: (provider: ChatModelProvider) => void,
  setEmbeddingModelProvider: (provider: EmbeddingModelProvider) => void,
  setIsConfigReady: (ready: boolean) => void,
  setHasError: (hasError: boolean) => void,
) => {
  try {
    let chatModelKey = localStorage.getItem('chatModelKey');
    let chatModelProviderId = localStorage.getItem('chatModelProviderId');
    let embeddingModelKey = localStorage.getItem('embeddingModelKey');
    let embeddingModelProviderId = localStorage.getItem(
      'embeddingModelProviderId',
    );

    const autoImageSearch = localStorage.getItem('autoImageSearch');
    const autoVideoSearch = localStorage.getItem('autoVideoSearch');

    if (!autoImageSearch) {
      localStorage.setItem('autoImageSearch', 'true');
    }

    if (!autoVideoSearch) {
      localStorage.setItem('autoVideoSearch', 'false');
    }

    const res = await fetch(`/api/providers`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(
        `Provider fetching failed with status code ${res.status}`,
      );
    }

    const data = await res.json();
    const providers: MinimalProvider[] = data.providers;

    if (providers.length === 0) {
      throw new Error(
        'No chat model providers found, please configure them in the settings page.',
      );
    }

    const chatModelProvider =
      providers.find((p) => p.id === chatModelProviderId) ??
      providers.find((p) => p.chatModels.length > 0);

    if (!chatModelProvider) {
      throw new Error(
        'No chat models found, pleae configure them in the settings page.',
      );
    }

    chatModelProviderId = chatModelProvider.id;

    const chatModel =
      chatModelProvider.chatModels.find((m) => m.key === chatModelKey) ??
      chatModelProvider.chatModels[0];
    chatModelKey = chatModel.key;

    const embeddingModelProvider =
      providers.find((p) => p.id === embeddingModelProviderId) ??
      providers.find((p) => p.embeddingModels.length > 0);

    if (!embeddingModelProvider) {
      throw new Error(
        'No embedding models found, pleae configure them in the settings page.',
      );
    }

    embeddingModelProviderId = embeddingModelProvider.id;

    const embeddingModel =
      embeddingModelProvider.embeddingModels.find(
        (m) => m.key === embeddingModelKey,
      ) ?? embeddingModelProvider.embeddingModels[0];
    embeddingModelKey = embeddingModel.key;

    localStorage.setItem('chatModelKey', chatModelKey);
    localStorage.setItem('chatModelProviderId', chatModelProviderId);
    localStorage.setItem('embeddingModelKey', embeddingModelKey);
    localStorage.setItem('embeddingModelProviderId', embeddingModelProviderId);

    setChatModelProvider({
      key: chatModelKey,
      providerId: chatModelProviderId,
    });

    setEmbeddingModelProvider({
      key: embeddingModelKey,
      providerId: embeddingModelProviderId,
    });

    setIsConfigReady(true);
  } catch (err: any) {
    console.error('An error occurred while checking the configuration:', err);
    toast.error(err.message);
    setIsConfigReady(false);
    setHasError(true);
  }
};

const loadMessages = async (
  chatId: string,
  setMessages: (messages: Message[]) => void,
  setIsMessagesLoaded: (loaded: boolean) => void,
  setChatHistory: (history: [string, string][]) => void,
  setFocusMode: (mode: string) => void,
  setNotFound: (notFound: boolean) => void,
  setFiles: (files: File[]) => void,
  setFileIds: (fileIds: string[]) => void,
) => {
  const res = await fetch(`/api/chats/${chatId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 404) {
    setNotFound(true);
    setIsMessagesLoaded(true);
    return;
  }

  const data = await res.json();

  const messages = data.messages as Message[];

  setMessages(messages);

  const chatTurns = messages.filter(
    (msg): msg is ChatTurn => msg.role === 'user' || msg.role === 'assistant',
  );

  const history = chatTurns.map((msg) => {
    return [msg.role, msg.content];
  }) as [string, string][];

  console.debug(new Date(), 'app:messages_loaded');

  if (chatTurns.length > 0) {
    document.title = chatTurns[0].content;
  }

  const files = data.chat.files.map((file: any) => {
    return {
      fileName: file.name,
      fileExtension: file.name.split('.').pop(),
      fileId: file.fileId,
    };
  });

  setFiles(files);
  setFileIds(files.map((file: File) => file.fileId));

  setChatHistory(history);
  setFocusMode(data.chat.focusMode);
  setIsMessagesLoaded(true);
};

export const chatContext = createContext<ChatContext>({
  chatHistory: [],
  chatId: '',
  fileIds: [],
  files: [],
  focusMode: '',
  hasError: false,
  isMessagesLoaded: false,
  isReady: false,
  loading: false,
  messageAppeared: false,
  messages: [],
  chatTurns: [],
  sections: [],
  notFound: false,
  optimizationMode: '',
  rewrite: () => {},
  sendMessage: async () => {},
  setFileIds: () => {},
  setFiles: () => {},
  setFocusMode: () => {},
  setOptimizationMode: () => {},
});

export const ChatProvider = ({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) => {
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('q');

  const [chatId, setChatId] = useState<string | undefined>(id);
  const [newChatCreated, setNewChatCreated] = useState(false);

  const [loading, setLoading] = useState(false);
  const [messageAppeared, setMessageAppeared] = useState(false);

  const [chatHistory, setChatHistory] = useState<[string, string][]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);

  const [focusMode, setFocusMode] = useState('webSearch');
  const [optimizationMode, setOptimizationMode] = useState('speed');

  const [isMessagesLoaded, setIsMessagesLoaded] = useState(false);

  const [notFound, setNotFound] = useState(false);

  const [chatModelProvider, setChatModelProvider] = useState<ChatModelProvider>(
    {
      key: '',
      providerId: '',
    },
  );

  const [embeddingModelProvider, setEmbeddingModelProvider] =
    useState<EmbeddingModelProvider>({
      key: '',
      providerId: '',
    });

  const [isConfigReady, setIsConfigReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const messagesRef = useRef<Message[]>([]);

  const chatTurns = useMemo((): ChatTurn[] => {
    return messages.filter(
      (msg): msg is ChatTurn => msg.role === 'user' || msg.role === 'assistant',
    );
  }, [messages]);

  const sections = useMemo<Section[]>(() => {
    const sections: Section[] = [];

    messages.forEach((msg, i) => {
      if (msg.role === 'user') {
        const nextUserMessageIndex = messages.findIndex(
          (m, j) => j > i && m.role === 'user',
        );

        const aiMessage = messages.find(
          (m, j) =>
            j > i &&
            m.role === 'assistant' &&
            (nextUserMessageIndex === -1 || j < nextUserMessageIndex),
        ) as AssistantMessage | undefined;

        const sourceMessage = messages.find(
          (m, j) =>
            j > i &&
            m.role === 'source' &&
            m.sources &&
            (nextUserMessageIndex === -1 || j < nextUserMessageIndex),
        ) as SourceMessage | undefined;

        let thinkingEnded = false;
        let processedMessage = aiMessage?.content ?? '';
        let speechMessage = aiMessage?.content ?? '';
        let suggestions: string[] = [];

        if (aiMessage) {
          const citationRegex = /\[([^\]]+)\]/g;
          const regex = /\[(\d+)\]/g;

          if (processedMessage.includes('<think>')) {
            const openThinkTag =
              processedMessage.match(/<think>/g)?.length || 0;
            const closeThinkTag =
              processedMessage.match(/<\/think>/g)?.length || 0;

            if (openThinkTag && !closeThinkTag) {
              processedMessage += '</think> <a> </a>';
            }
          }

          if (aiMessage.content.includes('</think>')) {
            thinkingEnded = true;
          }

          if (
            sourceMessage &&
            sourceMessage.sources &&
            sourceMessage.sources.length > 0
          ) {
            processedMessage = processedMessage.replace(
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

                    const source = sourceMessage.sources?.[number - 1];
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
            speechMessage = aiMessage.content.replace(regex, '');
          } else {
            processedMessage = processedMessage.replace(regex, '');
            speechMessage = aiMessage.content.replace(regex, '');
          }

          const suggestionMessage = messages.find(
            (m, j) =>
              j > i &&
              m.role === 'suggestion' &&
              (nextUserMessageIndex === -1 || j < nextUserMessageIndex),
          ) as SuggestionMessage | undefined;

          if (suggestionMessage && suggestionMessage.suggestions.length > 0) {
            suggestions = suggestionMessage.suggestions;
          }
        }

        sections.push({
          userMessage: msg,
          assistantMessage: aiMessage,
          sourceMessage: sourceMessage,
          parsedAssistantMessage: processedMessage,
          speechMessage,
          thinkingEnded,
          suggestions: suggestions,
        });
      }
    });

    return sections;
  }, [messages]);

  useEffect(() => {
    checkConfig(
      setChatModelProvider,
      setEmbeddingModelProvider,
      setIsConfigReady,
      setHasError,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      chatId &&
      !newChatCreated &&
      !isMessagesLoaded &&
      messages.length === 0
    ) {
      loadMessages(
        chatId,
        setMessages,
        setIsMessagesLoaded,
        setChatHistory,
        setFocusMode,
        setNotFound,
        setFiles,
        setFileIds,
      );
    } else if (!chatId) {
      setNewChatCreated(true);
      setIsMessagesLoaded(true);
      setChatId(crypto.randomBytes(20).toString('hex'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (isMessagesLoaded && isConfigReady) {
      setIsReady(true);
      console.debug(new Date(), 'app:ready');
    } else {
      setIsReady(false);
    }
  }, [isMessagesLoaded, isConfigReady]);

  const rewrite = (messageId: string) => {
    const index = messages.findIndex((msg) => msg.messageId === messageId);
    const chatTurnsIndex = chatTurns.findIndex(
      (msg) => msg.messageId === messageId,
    );

    if (index === -1) return;

    const message = chatTurns[chatTurnsIndex - 1];

    setMessages((prev) => {
      return [
        ...prev.slice(0, messages.length > 2 ? messages.indexOf(message) : 0),
      ];
    });
    setChatHistory((prev) => {
      return [...prev.slice(0, chatTurns.length > 2 ? chatTurnsIndex - 1 : 0)];
    });

    sendMessage(message.content, message.messageId, true);
  };

  useEffect(() => {
    if (isReady && initialMessage && isConfigReady) {
      if (!isConfigReady) {
        toast.error('Cannot send message before the configuration is ready');
        return;
      }
      sendMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigReady, isReady, initialMessage]);

  const sendMessage: ChatContext['sendMessage'] = async (
    message,
    messageId,
    rewrite = false,
  ) => {
    if (loading) return;
    setLoading(true);
    setMessageAppeared(false);

    if (messages.length <= 1) {
      window.history.replaceState(null, '', `/c/${chatId}`);
    }

    let recievedMessage = '';
    let added = false;

    messageId = messageId ?? crypto.randomBytes(7).toString('hex');

    setMessages((prevMessages) => [
      ...prevMessages,
      {
        content: message,
        messageId: messageId,
        chatId: chatId!,
        role: 'user',
        createdAt: new Date(),
      },
    ]);

    const messageHandler = async (data: any) => {
      if (data.type === 'error') {
        toast.error(data.data);
        setLoading(false);
        return;
      }

      if (data.type === 'sources') {
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            messageId: data.messageId,
            chatId: chatId!,
            role: 'source',
            sources: data.data,
            createdAt: new Date(),
          },
        ]);
        if (data.data.length > 0) {
          setMessageAppeared(true);
        }
      }

      if (data.type === 'message') {
        if (!added) {
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              content: data.data,
              messageId: data.messageId,
              chatId: chatId!,
              role: 'assistant',
              createdAt: new Date(),
            },
          ]);
          added = true;
          setMessageAppeared(true);
        } else {
          setMessages((prev) =>
            prev.map((message) => {
              if (
                message.messageId === data.messageId &&
                message.role === 'assistant'
              ) {
                return { ...message, content: message.content + data.data };
              }

              return message;
            }),
          );
        }
        recievedMessage += data.data;
      }

      if (data.type === 'messageEnd') {
        setChatHistory((prevHistory) => [
          ...prevHistory,
          ['human', message],
          ['assistant', recievedMessage],
        ]);

        setLoading(false);

        const lastMsg = messagesRef.current[messagesRef.current.length - 1];

        const autoImageSearch = localStorage.getItem('autoImageSearch');
        const autoVideoSearch = localStorage.getItem('autoVideoSearch');

        if (autoImageSearch === 'true') {
          document
            .getElementById(`search-images-${lastMsg.messageId}`)
            ?.click();
        }

        if (autoVideoSearch === 'true') {
          document
            .getElementById(`search-videos-${lastMsg.messageId}`)
            ?.click();
        }

        /* Check if there are sources after message id's index and no suggestions */

        const userMessageIndex = messagesRef.current.findIndex(
          (msg) => msg.messageId === messageId && msg.role === 'user',
        );

        const sourceMessage = messagesRef.current.find(
          (msg, i) => i > userMessageIndex && msg.role === 'source',
        ) as SourceMessage | undefined;

        const suggestionMessageIndex = messagesRef.current.findIndex(
          (msg, i) => i > userMessageIndex && msg.role === 'suggestion',
        );

        if (
          sourceMessage &&
          sourceMessage.sources.length > 0 &&
          suggestionMessageIndex == -1
        ) {
          const suggestions = await getSuggestions(messagesRef.current);
          setMessages((prev) => {
            return [
              ...prev,
              {
                role: 'suggestion',
                suggestions: suggestions,
                chatId: chatId!,
                createdAt: new Date(),
                messageId: crypto.randomBytes(7).toString('hex'),
              },
            ];
          });
        }
      }
    };

    const messageIndex = messages.findIndex((m) => m.messageId === messageId);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
        message: {
          messageId: messageId,
          chatId: chatId!,
          content: message,
        },
        chatId: chatId!,
        files: fileIds,
        focusMode: focusMode,
        optimizationMode: optimizationMode,
        history: rewrite
          ? chatHistory.slice(0, messageIndex === -1 ? undefined : messageIndex)
          : chatHistory,
        chatModel: {
          key: chatModelProvider.key,
          providerId: chatModelProvider.providerId,
        },
        embeddingModel: {
          key: embeddingModelProvider.key,
          providerId: embeddingModelProvider.providerId,
        },
        systemInstructions: localStorage.getItem('systemInstructions'),
      }),
    });

    if (!res.body) throw new Error('No response body');

    const reader = res.body?.getReader();
    const decoder = new TextDecoder('utf-8');

    let partialChunk = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      partialChunk += decoder.decode(value, { stream: true });

      try {
        const messages = partialChunk.split('\n');
        for (const msg of messages) {
          if (!msg.trim()) continue;
          const json = JSON.parse(msg);
          messageHandler(json);
        }
        partialChunk = '';
      } catch (error) {
        console.warn('Incomplete JSON, waiting for next chunk...');
      }
    }
  };

  return (
    <chatContext.Provider
      value={{
        messages,
        chatTurns,
        sections,
        chatHistory,
        files,
        fileIds,
        focusMode,
        chatId,
        hasError,
        isMessagesLoaded,
        isReady,
        loading,
        messageAppeared,
        notFound,
        optimizationMode,
        setFileIds,
        setFiles,
        setFocusMode,
        setOptimizationMode,
        rewrite,
        sendMessage,
      }}
    >
      {children}
    </chatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(chatContext);
  return ctx;
};
