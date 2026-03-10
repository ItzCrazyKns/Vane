import { cn } from '@/lib/utils';
import { ArrowUp, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import AttachSmall from './MessageInputActions/AttachSmall';
import { useChat } from '@/lib/hooks/useChat';
import { useFileHandler } from '@/lib/hooks/useFileHandler';

const MessageInput = () => {
  const { loading, sendMessage } = useChat();
  const {
    isDragging,
    isUploading,
    uploadingFileName,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useFileHandler();

  const [copilotEnabled, setCopilotEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [textareaRows, setTextareaRows] = useState(1);
  const [mode, setMode] = useState<'multi' | 'single'>('single');

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
    <div className="relative">
      {isUploading && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 shadow-md z-20">
          <LoaderCircle size={14} className="text-sky-500 animate-spin" />
          <span className="text-xs text-black/70 dark:text-white/70 whitespace-nowrap">
            Uploading{' '}
            {uploadingFileName.length > 20
              ? uploadingFileName.substring(0, 20) + '...'
              : uploadingFileName}
          </span>
        </div>
      )}
      <form
        onSubmit={(e) => {
          if (loading) return;
          e.preventDefault();
          sendMessage(message);
          setMessage('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !loading) {
            e.preventDefault();
            sendMessage(message);
            setMessage('');
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative bg-light-secondary dark:bg-dark-secondary p-4 flex items-center overflow-visible border border-light-200 dark:border-dark-200 shadow-sm shadow-light-200/10 dark:shadow-black/20 transition-all duration-200 focus-within:border-light-300 dark:focus-within:border-dark-300',
          mode === 'multi' ? 'flex-col rounded-2xl' : 'flex-row rounded-full',
          isDragging && 'border-sky-500 dark:border-sky-500 bg-sky-500/5',
        )}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center rounded-inherit z-10 pointer-events-none">
            <span className="text-sky-500 text-sm font-medium">
              Drop files here
            </span>
          </div>
        )}
        {mode === 'single' && <AttachSmall />}
        <TextareaAutosize
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onPaste={handlePaste}
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
    </div>
  );
};

export default MessageInput;
