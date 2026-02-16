'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface ThinkBoxProps {
  content: string;
  thinkingEnded: boolean;
}

const ThinkBox = ({ content, thinkingEnded }: ThinkBoxProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (thinkingEnded) {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
    }
  }, [thinkingEnded]);

  return (
    <div className="my-4 bg-light-secondary/30 dark:bg-dark-secondary/30 rounded-xl border border-light-200 dark:border-dark-200 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-black/90 dark:text-white/90 hover:bg-light-200 dark:hover:bg-dark-200 transition duration-200"
      >
        <div className="flex items-center space-x-2">
          <Sparkles
            size={18}
            className="text-[#9C27B0] dark:text-[#CE93D8]"
          />
          <p className="font-medium text-sm">Reasoning</p>
        </div>
        {isExpanded ? (
          <ChevronUp size={18} className="text-black/70 dark:text-white/70" />
        ) : (
          <ChevronDown size={18} className="text-black/70 dark:text-white/70" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 py-3 text-black/80 dark:text-white/80 text-sm border-t border-light-200 dark:border-dark-200 bg-transparent whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
      )}
    </div>
  );
};

export default ThinkBox;
