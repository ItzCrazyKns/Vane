import { cn } from '@/lib/utils';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import Sources from './MessageInputActions/Sources';
import Optimization from './MessageInputActions/Optimization';
import Attach from './MessageInputActions/Attach';
import { useChat } from '@/lib/hooks/useChat';
import { useFileHandler } from '@/lib/hooks/useFileHandler';
import ModelSelector from './MessageInputActions/ChatModelSelector';

const EmptyChatMessageInput = () => {
  const { sendMessage } = useChat();
  const {
    isDragging,
    isUploading,
    uploadingFileName,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useFileHandler();

  /* const [copilotEnabled, setCopilotEnabled] = useState(false); */
  const [message, setMessage] = useState('');

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

    inputRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        sendMessage(message);
        setMessage('');
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage(message);
          setMessage('');
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="w-full"
    >
      <div
        className={cn(
          'flex flex-col bg-light-secondary dark:bg-dark-secondary px-3 pt-5 pb-3 rounded-2xl w-full border border-light-200 dark:border-dark-200 shadow-sm shadow-light-200/10 dark:shadow-black/20 transition-all duration-200 focus-within:border-light-300 dark:focus-within:border-dark-300 relative',
          isDragging && 'border-sky-500 dark:border-sky-500 bg-sky-500/5',
        )}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl z-10 pointer-events-none">
            <span className="text-sky-500 text-sm font-medium">
              Drop files here
            </span>
          </div>
        )}
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
        <TextareaAutosize
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onPaste={handlePaste}
          minRows={2}
          className="px-2 bg-transparent placeholder:text-[15px] placeholder:text-black/50 dark:placeholder:text-white/50 text-sm text-black dark:text-white resize-none focus:outline-none w-full max-h-24 lg:max-h-36 xl:max-h-48"
          placeholder="Ask anything..."
        />
        <div className="flex flex-row items-center justify-between mt-4">
          <Optimization />
          <div className="flex flex-row items-center space-x-2">
            <div className="flex flex-row items-center space-x-1">
              <Sources />
              <ModelSelector />
              <Attach />
            </div>
            <button
              disabled={message.trim().length === 0}
              className="bg-sky-500 text-white disabled:text-black/50 dark:disabled:text-white/50 disabled:bg-[#e0e0dc] dark:disabled:bg-[#ececec21] hover:bg-opacity-85 transition duration-100 rounded-full p-2"
            >
              <ArrowRight className="bg-background" size={17} />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default EmptyChatMessageInput;
