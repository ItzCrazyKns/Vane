import { cn } from '@/lib/utils';
import { ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import AttachSmall from './MessageInputActions/AttachSmall';
import AttachmentReindexNotice from './MessageInputActions/AttachmentReindexNotice';
import { useChat } from '@/lib/hooks/useChat';

const MessageInput = () => {
  const { loading, rejectedDraft, sendMessage } = useChat();

  const [copilotEnabled, setCopilotEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [textareaRows, setTextareaRows] = useState(1);
  const [mode, setMode] = useState<'multi' | 'single'>('single');

  useEffect(() => {
    if (rejectedDraft) setMessage((draft) => draft || rejectedDraft);
  }, [rejectedDraft]);

  useEffect(() => {
    if (textareaRows >= 2 && message && mode === 'single') {
      setMode('multi');
    } else if (!message && mode === 'multi') {
      setMode('single');
    }
  }, [textareaRows, mode, message]);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;

      const isInputFocused =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.hasAttribute('contenteditable');

      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <>
      <AttachmentReindexNotice />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (loading || !message.trim()) return;
          sendMessage(message);
          setMessage('');
        }}
        onKeyDown={(e) => {
          if (
            e.target === inputRef.current &&
            e.key === 'Enter' &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            e.currentTarget.requestSubmit();
          }
        }}
        className={cn(
          'relative bg-light-secondary dark:bg-dark-secondary p-4 flex items-center overflow-visible border border-light-200 dark:border-dark-200 shadow-sm shadow-light-200/10 dark:shadow-black/20 transition-all duration-200 focus-within:border-light-300 dark:focus-within:border-dark-300',
          mode === 'multi' ? 'flex-col rounded-2xl' : 'flex-row rounded-full',
        )}
      >
        {mode === 'single' && <AttachSmall />}
        <TextareaAutosize
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onHeightChange={(height, props) => {
            setTextareaRows(Math.ceil(height / props.rowHeight));
          }}
          className="transition bg-transparent dark:placeholder:text-white/50 placeholder:text-sm text-sm dark:text-white resize-none focus:outline-none w-full px-2 max-h-24 lg:max-h-36 xl:max-h-48 flex-grow flex-shrink"
          placeholder="Ask a follow-up"
        />
        {mode === 'single' && (
          <button
            disabled={message.trim().length === 0 || loading}
            className="bg-[#24A0ED] text-white disabled:text-black/50 dark:disabled:text-white/50 hover:bg-opacity-85 transition duration-100 disabled:bg-[#e0e0dc79] dark:disabled:bg-[#ececec21] rounded-full p-2"
          >
            <ArrowUp className="bg-background" size={17} />
          </button>
        )}
        {mode === 'multi' && (
          <div className="flex flex-row items-center justify-between w-full pt-2">
            <AttachSmall />
            <button
              disabled={message.trim().length === 0 || loading}
              className="bg-[#24A0ED] text-white disabled:text-black/50 dark:disabled:text-white/50 hover:bg-opacity-85 transition duration-100 disabled:bg-[#e0e0dc79] dark:disabled:bg-[#ececec21] rounded-full p-2"
            >
              <ArrowUp className="bg-background" size={17} />
            </button>
          </div>
        )}
      </form>
    </>
  );
};

export default MessageInput;
