import { Check, ClipboardList } from 'lucide-react';
import { Message } from '../ChatWindow';
import { useState } from 'react';
import { Section } from '@/lib/hooks/useChat';
import { SourceBlock } from '@/lib/types';
import { useTranslations } from 'next-intl';

const Copy = ({
  section,
  initialMessage,
}: {
  section: Section;
  initialMessage: string;
}) => {
  const [copied, setCopied] = useState(false);
  const t = useTranslations('MessageActions');

  return (
    <button
      onClick={() => {
        const sources = section.message.responseBlocks.filter(
          (b) => b.type === 'source' && b.data.length > 0,
        ) as SourceBlock[];

        const contentToCopy = `${initialMessage}${
          sources.length > 0
            ? `\n\n${t('citations')}:\n${sources
                .map((source) => source.data)
                .flat()
                .map(
                  (s, i) =>
                    `[${i + 1}] ${s.metadata.url.startsWith('file_id://') ? s.metadata.fileName || t('uploadedFile') : s.metadata.url}`,
                )
                .join(`\n`)}`
            : ''
        }`;

        navigator.clipboard.writeText(contentToCopy);

        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      }}
      className="p-2 text-black/70 dark:text-white/70 rounded-full hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white"
    >
      {copied ? <Check size={16} /> : <ClipboardList size={16} />}
    </button>
  );
};

export default Copy;
