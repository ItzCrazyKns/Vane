import { Check, ClipboardList } from 'lucide-react';
import { Message } from '../ChatWindow';
import { useState } from 'react';

const Copy = ({
  message,
  initialMessage,
}: {
  message: Message;
  initialMessage: string;
}) => {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        const contentToCopy = `${initialMessage}${message.sources && message.sources.length > 0 && `\n\nCitations:\n${message.sources?.map((source: any, i: any) => `[${i + 1}] ${source.metadata.url}`).join(`\n`)}`}`;
        navigator.clipboard.writeText(contentToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      }}
      className="p-2 text-black/70 dark:text-white/70 rounded-xl hover:bg-secondLight dark:hover:bg-secondDark transition duration-200 hover:text-black dark:hover:text-white"
    >
      {copied ? <Check size={18} /> : <ClipboardList size={18} />}
    </button>
  );
};

export default Copy;
