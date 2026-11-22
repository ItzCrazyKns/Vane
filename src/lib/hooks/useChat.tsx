'use client';

import { Message } from '@/components/ChatWindow';
import { Block } from '@/lib/types';
import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import crypto from 'crypto';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';
import { MinimalProvider } from '../models/types';
import { getAutoMediaSearch } from '../config/clientRegistry';
import { applyPatch } from 'rfc6902';
import { Widget } from '@/components/ChatWindow';
import type { ChatRecovery } from '@/lib/db/schema';

export type Section = {
  message: Message;
  widgets: Widget[];
  parsedTextBlocks: string[];
  speechMessage: string;
  thinkingEnded: boolean;
  suggestions?: string[];
};

type ChatContext = {
  messages: Message[];
  sections: Section[];
  chatHistory: [string, string][];
  files: File[];
  fileIds: string[];
  sources: string[];
  chatId: string | undefined;
  optimizationMode: string;
  isMessagesLoaded: boolean;
  loading: boolean;
  notFound: boolean;
  messageAppeared: boolean;
  isReady: boolean;
  hasError: boolean;
  chatModelProvider: ChatModelProvider;
  embeddingModelProvider: EmbeddingModelProvider;
  researchEnded: boolean;
  filesNeedingReindex: AttachmentReindexFile[];
  clearReindexNotice: (fileId: string) => void;
  removeAttachment: (fileId: string) => void;
  setResearchEnded: (ended: boolean) => void;
  setOptimizationMode: (mode: string) => void;
  setSources: (sources: string[]) => void;
  setFiles: (files: File[]) => void;
  setFileIds: (fileIds: string[]) => void;
  sendMessage: (
    message: string,
    messageId?: string,
    rewrite?: boolean,
  ) => Promise<void>;
  rewrite: (messageId: string) => void;
  setChatModelProvider: (provider: ChatModelProvider) => void;
  setEmbeddingModelProvider: (provider: EmbeddingModelProvider) => void;
};

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

type AttachmentReindexFile = Pick<File, 'fileId' | 'fileName'> & {
  canReindex?: false;
};

type ComposerDrafts = {
  chatId: string | undefined;
  draft: string;
  saved: string[];
};

const composerDraftContext = createContext<{
  draft: string;
  savedDrafts: string[];
  setDraft: (draft: string) => void;
  restoreDraft: (index: number) => void;
}>({ draft: '', savedDrafts: [], setDraft: () => {}, restoreDraft: () => {} });

const setComposerDraftsContext = createContext<
  Dispatch<SetStateAction<ComposerDrafts>>
>(() => {});

const ComposerDraftProvider = ({ children }: { children: React.ReactNode }) => {
  const { chatId } = useParams<{ chatId: string }>();
  const [drafts, setDrafts] = useState<ComposerDrafts>({
    chatId,
    draft: '',
    saved: [],
  });

  const setDraft = (draft: string) => {
    setDrafts((current) => ({ ...current, draft }));
  };

  const restoreDraft = (index: number) => {
    setDrafts((current) => {
      const saved = [...current.saved];
      const draft = saved[index];
      if (draft === undefined) return current;

      // Keep the text the user was editing available after restoring a draft.
      if (current.draft) saved[index] = current.draft;
      else saved.splice(index, 1);

      return { ...current, draft, saved };
    });
  };

  return (
    <setComposerDraftsContext.Provider value={setDrafts}>
      <composerDraftContext.Provider
        value={{
          draft: drafts.draft,
          savedDrafts: drafts.saved,
          setDraft,
          restoreDraft,
        }}
      >
        {children}
      </composerDraftContext.Provider>
    </setComposerDraftsContext.Provider>
  );
};

export const useComposerDraft = () => useContext(composerDraftContext);

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

const buildChatHistory = (messages: Message[]): [string, string][] => {
  const history: [string, string][] = [];
  messages.forEach((msg) => {
    if (msg.status === 'answering') return;

    history.push(['human', msg.query]);

    const textBlocks = msg.responseBlocks
      .filter(
        (block): block is Block & { type: 'text' } => block.type === 'text',
      )
      .map((block) => block.data)
      .join('\n');

    if (textBlocks) {
      history.push(['assistant', textBlocks]);
    }
  });

  return history;
};

type ChatDetail = {
  chat: { files: { fileId: string; name: string }[]; sources: string[] } | null;
  messages: Message[];
  recoveries: ChatRecovery[];
};

const toComposerFiles = (files: ChatRecovery['files']): File[] =>
  files.map(({ fileId, name }) => ({
    fileName: name,
    fileExtension: name.split('.').pop() ?? '',
    fileId,
  }));

const acknowledgeRecoveries = async (chatId: string, recoveryIds: string[]) => {
  try {
    const response = await fetch(`/api/chats/${chatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recoveryIds }),
    });
    if (!response.ok) throw new Error('Could not acknowledge draft recovery');
  } catch (error) {
    console.warn('Draft recovery remains available on reload:', error);
  }
};

const loadMessages = async (
  chatId: string,
  setMessages: (messages: Message[]) => void,
  setIsMessagesLoaded: (loaded: boolean) => void,
  chatHistory: React.MutableRefObject<[string, string][]>,
  setSources: (sources: string[]) => void,
  setNotFound: (notFound: boolean) => void,
  setFiles: (files: File[]) => void,
  setFileIds: (fileIds: string[]) => void,
  restoreRejections: (recoveries: ChatRecovery[], chatRemoved: boolean) => void,
  signal: AbortSignal,
) => {
  const res = await fetch(`/api/chats/${chatId}?recover=1`, { signal });
  if (signal.aborted) return;

  if (res.status === 404) {
    setNotFound(true);
    setIsMessagesLoaded(true);
    return;
  }

  if (!res.ok) throw new Error('Could not load this conversation');

  const { chat, messages, recoveries = [] }: ChatDetail = await res.json();
  if (signal.aborted) return;

  setMessages(messages);
  console.debug(new Date(), 'app:messages_loaded');

  if (messages.length > 0) {
    document.title = messages[0].query;
  }

  const latestRecovery = recoveries.at(-1);
  const files = toComposerFiles(latestRecovery?.files ?? chat?.files ?? []);

  setFiles(files);
  setFileIds(files.map((file) => file.fileId));

  chatHistory.current = buildChatHistory(messages);
  setSources(latestRecovery?.sources ?? chat?.sources ?? []);
  if (recoveries.length) restoreRejections(recoveries, !chat);
  setIsMessagesLoaded(true);
};

const readChatEvents = async (
  response: Response,
  handleEvent: (event: any) => void,
) => {
  if (!response.ok || !response.body)
    throw new Error('Could not open chat stream');

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let remainder = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      remainder += decoder.decode(value, { stream: true });
      const lines = remainder.split('\n');
      remainder = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) handleEvent(JSON.parse(line));
      }
    }
  } finally {
    reader.releaseLock();
  }
};

export const chatContext = createContext<ChatContext>({
  chatHistory: [],
  chatId: '',
  fileIds: [],
  files: [],
  sources: [],
  hasError: false,
  isMessagesLoaded: false,
  isReady: false,
  loading: false,
  messageAppeared: false,
  messages: [],
  sections: [],
  notFound: false,
  optimizationMode: '',
  chatModelProvider: { key: '', providerId: '' },
  embeddingModelProvider: { key: '', providerId: '' },
  researchEnded: false,
  filesNeedingReindex: [],
  clearReindexNotice: () => {},
  removeAttachment: () => {},
  rewrite: () => {},
  sendMessage: async () => {},
  setFileIds: () => {},
  setFiles: () => {},
  setSources: () => {},
  setOptimizationMode: () => {},
  setChatModelProvider: () => {},
  setEmbeddingModelProvider: () => {},
  setResearchEnded: () => {},
});

const ChatStateProvider = ({ children }: { children: React.ReactNode }) => {
  const params: { chatId: string } = useParams();

  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('q');

  const [chatId, setChatId] = useState<string | undefined>(params.chatId);
  const activeChatId = useRef(chatId);
  const [newChatCreated, setNewChatCreated] = useState(false);

  const [loading, setLoading] = useState(false);
  const [messageAppeared, setMessageAppeared] = useState(false);

  const [researchEnded, setResearchEnded] = useState(false);

  const chatHistory = useRef<[string, string][]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [filesNeedingReindex, setFilesNeedingReindex] = useState<
    AttachmentReindexFile[]
  >([]);
  const setComposerDrafts = useContext(setComposerDraftsContext);

  const [sources, setSources] = useState<string[]>(['web']);
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

  const sections = useMemo<Section[]>(() => {
    return messages.map((msg) => {
      const textBlocks: string[] = [];
      let speechMessage = '';
      let thinkingEnded = false;
      let suggestions: string[] = [];

      const sourceBlocks = msg.responseBlocks.filter(
        (block): block is Block & { type: 'source' } => block.type === 'source',
      );
      const sources = sourceBlocks.flatMap((block) => block.data);

      const widgetBlocks = msg.responseBlocks
        .filter((b) => b.type === 'widget')
        .map((b) => b.data) as Widget[];

      msg.responseBlocks.forEach((block) => {
        if (block.type === 'text') {
          let processedText = block.data;
          const citationRegex = /\[([^\]]+)\]/g;
          const regex = /\[(\d+)\]/g;

          if (processedText.includes('<think>')) {
            const openThinkTag = processedText.match(/<think>/g)?.length || 0;
            const closeThinkTag =
              processedText.match(/<\/think>/g)?.length || 0;

            if (openThinkTag && !closeThinkTag) {
              processedText += '</think> <a> </a>';
            }
          }

          if (block.data.includes('</think>')) {
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
            speechMessage += block.data.replace(regex, '');
          } else {
            processedText = processedText.replace(regex, '');
            speechMessage += block.data.replace(regex, '');
          }

          textBlocks.push(processedText);
        } else if (block.type === 'suggestion') {
          suggestions = block.data;
        }
      });

      return {
        message: msg,
        parsedTextBlocks: textBlocks,
        speechMessage,
        thinkingEnded,
        suggestions,
        widgets: widgetBlocks,
      };
    });
  }, [messages]);

  const isReconnectingRef = useRef(false);
  const handledMessageEndRef = useRef<Set<string>>(new Set());

  const checkReconnect = async () => {
    if (isReconnectingRef.current) return;

    setIsReady(true);
    console.debug(new Date(), 'app:ready');

    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];

      if (lastMsg.status === 'answering') {
        setLoading(true);
        setResearchEnded(false);
        setMessageAppeared(false);

        isReconnectingRef.current = true;

        try {
          const response = await fetch(`/api/reconnect/${lastMsg.backendId}`, {
            method: 'POST',
          });
          await readChatEvents(
            response,
            getMessageHandler(lastMsg, undefined, true),
          );
        } catch {
          toast.error(
            'Could not reconnect to this response. Reload to try again.',
          );
        } finally {
          isReconnectingRef.current = false;
          setLoading(false);
        }
      }
    }
  };

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
    if (params.chatId && params.chatId !== chatId) {
      activeChatId.current = params.chatId;
      setChatId(params.chatId);
      setMessages([]);
      chatHistory.current = [];
      setFiles([]);
      setFileIds([]);
      setFilesNeedingReindex([]);
      setComposerDrafts({ chatId: params.chatId, draft: '', saved: [] });
      setIsMessagesLoaded(false);
      setNotFound(false);
      setNewChatCreated(false);
    }
  }, [params.chatId, chatId]);

  useEffect(() => {
    if (
      chatId &&
      !newChatCreated &&
      !isMessagesLoaded &&
      messages.length === 0
    ) {
      const controller = new AbortController();
      loadMessages(
        chatId,
        setMessages,
        setIsMessagesLoaded,
        chatHistory,
        setSources,
        setNotFound,
        setFiles,
        setFileIds,
        (recoveries, chatRemoved) => {
          if (activeChatId.current !== chatId) return;

          // The latest rejection supplies the attachment selection being restored.
          setFilesNeedingReindex(recoveries[recoveries.length - 1].errorFiles);
          for (const recovery of [...recoveries].reverse()) {
            preserveUnsentDraft(recovery.query);
          }
          if (chatRemoved) returnToComposer(chatId);
          void acknowledgeRecoveries(
            chatId,
            recoveries.map((recovery) => recovery.backendId),
          );
        },
        controller.signal,
      ).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not load this conversation',
        );
        setHasError(true);
      });

      return () => controller.abort();
    } else if (!chatId) {
      const newChatId = crypto.randomBytes(20).toString('hex');
      activeChatId.current = newChatId;
      setNewChatCreated(true);
      setIsMessagesLoaded(true);
      setChatId(newChatId);
      setComposerDrafts({ chatId: newChatId, draft: '', saved: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, isMessagesLoaded, newChatCreated, messages.length]);

  useEffect(() => {
    if (isMessagesLoaded && isConfigReady && newChatCreated) {
      setIsReady(true);
      console.debug(new Date(), 'app:ready');
    } else if (isMessagesLoaded && isConfigReady && !newChatCreated) {
      checkReconnect();
    } else {
      setIsReady(false);
    }
  }, [isMessagesLoaded, isConfigReady, newChatCreated]);

  const rewrite = (messageId: string) => {
    const index = messages.findIndex((msg) => msg.messageId === messageId);

    if (index === -1) return;

    const messageToRewrite = messages[index];
    sendMessage(messageToRewrite.query, messageToRewrite.messageId, true);
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

  const returnToComposer = (id: string) => {
    if (window.location.pathname === `/c/${id}`) {
      window.history.replaceState(null, '', '/');
    }
  };

  const preserveUnsentDraft = (draft: string) => {
    setComposerDrafts((current) => {
      if (current.chatId !== chatId || current.draft === draft) return current;
      if (!current.draft) return { ...current, draft };

      return { ...current, saved: [...current.saved, draft] };
    });
  };

  const reportAttachmentReindex = (
    error: {
      code?: string;
      files?: AttachmentReindexFile[];
    } | null,
  ) => {
    if (
      error?.code !== 'ATTACHMENT_REINDEX_REQUIRED' ||
      !Array.isArray(error.files)
    ) {
      return false;
    }

    setFilesNeedingReindex(error.files);
    return true;
  };

  const clearReindexNotice = (fileId: string) => {
    setFilesNeedingReindex((prev) =>
      prev.filter((file) => file.fileId !== fileId),
    );
  };

  const removeAttachment = (fileId: string) => {
    setFiles((prev) => prev.filter((file) => file.fileId !== fileId));
    setFileIds((prev) => prev.filter((id) => id !== fileId));
    clearReindexNotice(fileId);
  };

  const getMessageHandler = (
    message: Message,
    restoreRewrite?: () => void,
    reconnecting = false,
  ) => {
    const messageId = message.messageId;
    let responseBlocks = message.responseBlocks;

    // A stream chunk can contain both a block and messageEnd before React renders.
    const setResponseBlocks = (blocks: Block[]) => {
      responseBlocks = blocks;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageId === messageId
            ? { ...msg, responseBlocks: blocks }
            : msg,
        ),
      );
    };

    return (data: any) => {
      if (activeChatId.current !== message.chatId) return;

      if (data.type === 'error') {
        const needsReindex = reportAttachmentReindex(data.data);
        const rewriteConflict = data.data?.code === 'CHAT_REWRITE_CONFLICT';
        if (needsReindex || rewriteConflict) {
          if (restoreRewrite) {
            restoreRewrite();
          } else {
            setMessages((prev) =>
              prev.filter((msg) => msg.messageId !== messageId),
            );
            preserveUnsentDraft(message.query);
            if (needsReindex) {
              if (reconnecting && Array.isArray(data.data.recoveryFiles)) {
                const files = toComposerFiles(data.data.recoveryFiles);
                setFiles(files);
                setFileIds(files.map((file) => file.fileId));
                if (Array.isArray(data.data.recoverySources)) {
                  setSources(data.data.recoverySources);
                }
              }
              if (data.data.chatRemoved === true)
                returnToComposer(message.chatId);
              if (typeof data.data.recoveryId === 'string') {
                void acknowledgeRecoveries(message.chatId, [
                  data.data.recoveryId,
                ]);
              }
            }
          }
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageId === messageId
                ? { ...msg, status: 'error' as const }
                : msg,
            ),
          );
        }
        if (!needsReindex) {
          toast.error(
            data.data?.message || data.data || 'Failed to send message.',
          );
        }
        return;
      }

      if (data.type === 'researchComplete') {
        setResearchEnded(true);
        if (
          responseBlocks.find((b) => b.type === 'source' && b.data.length > 0)
        ) {
          setMessageAppeared(true);
        }
      }

      if (data.type === 'block') {
        const block: Block = data.block;
        const alreadyReceived = responseBlocks.some(
          (item) => item.id === block.id,
        );
        setResponseBlocks(
          alreadyReceived
            ? responseBlocks.map((item) =>
                item.id === block.id ? block : item,
              )
            : [...responseBlocks, block],
        );

        if (
          (data.block.type === 'source' && data.block.data.length > 0) ||
          data.block.type === 'text'
        ) {
          setMessageAppeared(true);
        }
      }

      if (data.type === 'updateBlock') {
        setResponseBlocks(
          responseBlocks.map((block) => {
            if (block.id !== data.blockId) return block;
            const updatedBlock = structuredClone(block);
            applyPatch(updatedBlock, data.patch);
            return updatedBlock;
          }),
        );
      }

      if (data.type === 'messageEnd') {
        if (handledMessageEndRef.current.has(messageId)) {
          return;
        }

        handledMessageEndRef.current.add(messageId);

        const newHistory: [string, string][] = [
          ...chatHistory.current,
          ['human', message.query],
          [
            'assistant',
            responseBlocks.find((b) => b.type === 'text')?.data || '',
          ],
        ];

        chatHistory.current = newHistory;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === messageId
              ? { ...msg, status: 'completed' as const }
              : msg,
          ),
        );

        const autoMediaSearch = getAutoMediaSearch();

        if (autoMediaSearch) {
          setTimeout(() => {
            document.getElementById(`search-images-${messageId}`)?.click();

            document.getElementById(`search-videos-${messageId}`)?.click();
          }, 200);
        }

        // Check if there are sources and no suggestions

        const hasSourceBlocks = responseBlocks.some(
          (block) => block.type === 'source' && block.data.length > 0,
        );
        const hasSuggestions = responseBlocks.some(
          (block) => block.type === 'suggestion',
        );

        if (hasSourceBlocks && !hasSuggestions) {
          getSuggestions(newHistory)
            .then((suggestions) => {
              const suggestionBlock: Block = {
                id: crypto.randomBytes(7).toString('hex'),
                type: 'suggestion',
                data: suggestions,
              };

              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.messageId === messageId) {
                    return {
                      ...msg,
                      responseBlocks: [...msg.responseBlocks, suggestionBlock],
                    };
                  }
                  return msg;
                }),
              );
            })
            .catch((error) =>
              console.error('Unable to load suggestions:', error),
            );
        }
      }
    };
  };

  const sendMessage: ChatContext['sendMessage'] = async (
    message,
    messageId,
    rewrite = false,
  ) => {
    if (loading || !message) return;
    setLoading(true);

    messageId = messageId ?? crypto.randomBytes(7).toString('hex');
    const backendId = crypto.randomBytes(20).toString('hex');

    const newMessage: Message = {
      messageId,
      chatId: chatId!,
      backendId,
      query: message,
      responseBlocks: [],
      status: 'answering',
      createdAt: new Date(),
    };

    const messageIndex = messages.findIndex((m) => m.messageId === messageId);
    const previousHistory = chatHistory.current;
    const requestHistory =
      rewrite && messageIndex !== -1
        ? buildChatHistory(messages.slice(0, messageIndex))
        : previousHistory;

    let accepted = false;
    try {
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
          sources: sources,
          optimizationMode: optimizationMode,
          history: requestHistory,
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

      if (!res.ok) {
        const error = await res.json().catch(() => null);

        if (res.status === 409 && reportAttachmentReindex(error)) {
          if (!rewrite) preserveUnsentDraft(message);
          return;
        }
        throw new Error(error?.message || 'Failed to send message.');
      }

      accepted = true;
      if (!res.body) throw new Error('No response body');

      setFilesNeedingReindex([]);
      setResearchEnded(false);
      setMessageAppeared(false);

      if (messages.length <= 1) {
        window.history.replaceState(null, '', `/c/${chatId}`);
      }

      // Keep the existing answer and history until the server accepts the rewrite.
      if (rewrite) {
        chatHistory.current = requestHistory;
        handledMessageEndRef.current.delete(messageId);
      }
      setMessages((prev) => [
        ...(rewrite && messageIndex !== -1
          ? prev.slice(0, messageIndex)
          : prev),
        newMessage,
      ]);

      const restoreRewrite = rewrite
        ? () => {
            chatHistory.current = previousHistory;
            setMessages(messages);
          }
        : undefined;
      await readChatEvents(res, getMessageHandler(newMessage, restoreRewrite));
    } catch (error) {
      if (!accepted && !rewrite) preserveUnsentDraft(message);
      toast.error(
        error instanceof Error ? error.message : 'Failed to send message.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <chatContext.Provider
      value={{
        messages,
        sections,
        chatHistory: chatHistory.current,
        files,
        fileIds,
        filesNeedingReindex,
        clearReindexNotice,
        removeAttachment,
        sources,
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
        setSources,
        setOptimizationMode,
        rewrite,
        sendMessage,
        setChatModelProvider,
        chatModelProvider,
        embeddingModelProvider,
        setEmbeddingModelProvider,
        researchEnded,
        setResearchEnded,
      }}
    >
      {children}
    </chatContext.Provider>
  );
};

export const ChatProvider = ({ children }: { children: React.ReactNode }) => (
  <ComposerDraftProvider>
    <ChatStateProvider>{children}</ChatStateProvider>
  </ComposerDraftProvider>
);

export const useChat = () => {
  const ctx = useContext(chatContext);
  return ctx;
};
