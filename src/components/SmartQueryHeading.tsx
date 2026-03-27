'use client';

import { useState, useRef, useEffect } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';

interface SmartQueryHeadingProps {
  query: string;
}

const SmartQueryHeading = ({ query }: SmartQueryHeadingProps) => {
  const [lineCount, setLineCount] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!measureRef.current) return;
    const el = measureRef.current;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    const lines = Math.ceil(el.scrollHeight / lineHeight);
    setLineCount(lines);
  }, [query]);

  useEffect(() => {
    setIsExpanded(false);
  }, [query]);

  const getTextSize = () => {
    if (lineCount === null || lineCount <= 2) return 'text-3xl';
    if (lineCount <= 3) return 'text-2xl';
    if (lineCount <= 5) return 'text-xl';
    if (lineCount <= 8) return 'text-base';
    return 'text-sm';
  };

  const needsExpand = lineCount !== null && lineCount > 4;

  return (
    <div className="w-full pt-8 break-words">

      {/* ✅ Measurement div — fully off-screen, never affects layout */}
      <div
        ref={measureRef}
        aria-hidden
        className="text-3xl font-medium leading-snug pointer-events-none select-none"
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '60%', // approximate lg:w-9/12 width
          visibility: 'hidden',
        }}
      >
        {query}
      </div>

      <div className="lg:w-9/12">
        {/* Visible heading */}
        <div className="relative">
          <div
            className={`transition-[max-height] duration-300 ease-in-out overflow-hidden ${
              needsExpand && !isExpanded ? 'max-h-[5.5rem]' : 'max-h-[600px]'
            }`}
          >
            <h2
              className={`text-black dark:text-white font-medium leading-snug transition-all duration-200 ${getTextSize()}`}
            >
              {query}
            </h2>
          </div>

          {/* Gradient fade when collapsed */}
          {needsExpand && !isExpanded && (
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white dark:from-[#0f0f0f] to-transparent pointer-events-none" />
          )}
        </div>

        {/* Expand / Collapse toggle */}
        {needsExpand && (
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[#24A0ED] hover:text-blue-400 active:scale-95 transition-all duration-150"
          >
            {isExpanded ? (
              <>
                <CaretUp size={14} weight="bold" />
                Show less
              </>
            ) : (
              <>
                <CaretDown size={14} weight="bold" />
                Show more
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default SmartQueryHeading;
