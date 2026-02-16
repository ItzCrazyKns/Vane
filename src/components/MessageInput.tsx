import { cn } from '@/lib/utils';
import { ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import AttachSmall from './MessageInputActions/AttachSmall';
import { useChat } from '@/lib/hooks/useChat';
import Focus from './MessageInputActions/Focus';
import ProToggle from './MessageInputActions/ProToggle';
import { X } from 'lucide-react';
import VoiceInput from './VoiceInput';

const MessageInput = () => {
  const { loading, sendMessage, files, setFiles, setFileIds } = useChat();

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

  const removeFile = (fileId: string) => {
    setFiles(files.filter((f) => f.fileId !== fileId));
    setFileIds(files.filter((f) => f.fileId !== fileId).map((f) => f.fileId));
  };

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
      className={cn(
        'relative bg-light-secondary/80 dark:bg-dark-secondary/80 backdrop-blur-md p-4 flex items-center overflow-visible border border-light-200 dark:border-dark-200 shadow-xl shadow-light-200/10 dark:shadow-black/20 transition-all duration-200 focus-within:border-light-300 dark:focus-within:border-dark-300',
        mode === 'multi' ? 'flex-col rounded-[32px]' : 'flex-row rounded-[32px]',
      )}
    >
      {files.length > 0 && (
        <div className="flex flex-row items-center gap-2 w-full pb-2 overflow-x-auto">
          {files.map((file) => (
            <div
              key={file.fileId}
              className="relative group flex items-center justify-center bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-xl overflow-hidden w-16 h-16 flex-shrink-0"
            >
              <div className="text-xs text-black/50 dark:text-white/50 text-center px-1 break-all line-clamp-2">
                {file.fileExtension}
              </div>
              <button
                onClick={() => removeFile(file.fileId)}
                className="absolute top-0.5 right-0.5 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      {mode === 'single' && (
        <div className="flex items-center gap-4">
           <Focus />
           <ProToggle />
           <div className="w-px h-4 bg-black/10 dark:bg-white/10" />
           <AttachSmall />
        </div>
      )}
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
        <div className="flex items-center gap-2">
          {message.trim().length === 0 && (
             <VoiceInput onTranscript={(text) => setMessage(text)} />
          )}
          <button
            disabled={message.trim().length === 0 || loading}
            className="bg-[#24A0ED] text-white disabled:text-black/50 dark:disabled:text-white/50 hover:bg-opacity-85 transition duration-100 disabled:bg-[#e0e0dc79] dark:disabled:bg-[#ececec21] rounded-full p-2"
          >
            <ArrowUp className="bg-background" size={17} />
          </button>
        </div>
      )}
      {mode === 'multi' && (
        <div className="flex flex-row items-center justify-between w-full pt-2">
          <div className="flex items-center gap-4">
            <Focus />
            <ProToggle />
            <div className="w-px h-4 bg-black/10 dark:bg-white/10" />
            <AttachSmall />
          </div>
          <div className="flex items-center gap-2">
            {message.trim().length === 0 && (
               <VoiceInput onTranscript={(text) => setMessage(text)} />
            )}
            <button
              disabled={message.trim().length === 0 || loading}
              className="bg-[#24A0ED] text-white disabled:text-black/50 dark:disabled:text-white/50 hover:bg-opacity-85 transition duration-100 disabled:bg-[#e0e0dc79] dark:disabled:bg-[#ececec21] rounded-full p-2"
            >
              <ArrowUp className="bg-background" size={17} />
            </button>
          </div>
        </div>
      )}
    </form>
  );
};

export default MessageInput;
