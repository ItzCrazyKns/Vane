'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, BrainCircuit } from 'lucide-react';

interface ThinkBoxProps {
  content: string;
}

const ThinkBox = ({ content }: ThinkBoxProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="my-4 bg-light-secondary/50 dark:bg-dark-secondary/50 rounded-xl border border-light-200 dark:border-dark-200 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-1 text-black/90 dark:text-white/90 hover:bg-light-200 dark:hover:bg-dark-200 transition duration-200"
      >
        <div className="flex items-center space-x-2">
          <BrainCircuit
            size={20}
            className="text-[#9C27B0] dark:text-[#CE93D8]"
          />
          <p className="font-medium text-sm">Thinking Process</p>
        </div>
        {isExpanded ? (
          <ChevronUp size={18} className="text-black/70 dark:text-white/70" />
        ) : (
          <ChevronDown size={18} className="text-black/70 dark:text-white/70" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 py-3 text-black/80 dark:text-white/80 text-sm border-t border-light-200 dark:border-dark-200 bg-light-100/50 dark:bg-dark-100/50 whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
};

export default ThinkBox;
