'use client';

import {
  Brain,
  Search,
  FileText,
  ChevronDown,
  ChevronUp,
  BookSearch,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ResearchBlock, ResearchBlockSubStep } from '@/lib/types';
import { useChat } from '@/lib/hooks/useChat';

const getStepIcon = (step: ResearchBlockSubStep) => {
  if (step.type === 'reasoning') {
    return <Brain className="w-4 h-4" />;
  } else if (step.type === 'searching' || step.type === 'upload_searching') {
    return <Search className="w-4 h-4" />;
  } else if (
    step.type === 'search_results' ||
    step.type === 'upload_search_results'
  ) {
    return <FileText className="w-4 h-4" />;
  } else if (step.type === 'reading') {
    return <BookSearch className="w-4 h-4" />;
  }

  return null;
};

const getStepTitle = (
  step: ResearchBlockSubStep,
  isStreaming: boolean,
): string => {
  if (step.type === 'reasoning') {
    return isStreaming && !step.reasoning ? 'Thinking...' : 'Thinking';
  } else if (step.type === 'searching') {
    const queries = Array.isArray(step.searching) ? step.searching : [];
    return `Searching ${queries.length} ${queries.length === 1 ? 'query' : 'queries'}`;
  } else if (step.type === 'search_results') {
    return `Found ${step.reading.length} ${step.reading.length === 1 ? 'result' : 'results'}`;
  } else if (step.type === 'reading') {
    return `Reading ${step.reading.length} ${step.reading.length === 1 ? 'source' : 'sources'}`;
  } else if (step.type === 'upload_searching') {
    return 'Scanning your uploaded documents';
  } else if (step.type === 'upload_search_results') {
    return `Reading ${step.results.length} ${step.results.length === 1 ? 'document' : 'documents'}`;
  }

  return 'Processing';
};

const AssistantSteps = ({
  block,
  status,
  isLast,
}: {
  block: ResearchBlock;
  status: 'answering' | 'completed' | 'error';
  isLast: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(
    isLast && status === 'answering' ? true : false,
  );
  const { researchEnded, loading } = useChat();

  useEffect(() => {
    if (researchEnded && isLast) {
      setIsExpanded(false);
    } else if (status === 'answering' && isLast) {
      setIsExpanded(true);
    }
  }, [researchEnded, status]);

  if (!block || block.data.subSteps.length === 0) return null;

  return (
    <div className="rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-light-200 dark:hover:bg-dark-200 transition duration-200"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-black dark:text-white" />
          <span className="text-sm font-medium text-black dark:text-white">
            Research Progress ({block.data.subSteps.length}{' '}
            {block.data.subSteps.length === 1 ? 'step' : 'steps'})
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-black/70 dark:text-white/70" />
        ) : (
          <ChevronDown className="w-4 h-4 text-black/70 dark:text-white/70" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-light-200 dark:border-dark-200"
          >
            <div className="p-3 space-y-2">
              {block.data.subSteps.map((step, index) => {
                const isLastStep = index === block.data.subSteps.length - 1;
                const isStreaming = loading && isLastStep && !researchEnded;

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: 0 }}
                    className="flex gap-2"
                  >
                    <div className="flex flex-col items-center -mt-0.5">
                      <div
                        className={`rounded-full p-1.5 bg-light-100 dark:bg-dark-100 text-black/70 dark:text-white/70 ${isStreaming ? 'animate-pulse' : ''}`}
                      >
                        {getStepIcon(step)}
                      </div>
                      {index < block.data.subSteps.length - 1 && (
                        <div className="w-0.5 flex-1 min-h-[20px] bg-light-200 dark:bg-dark-200 mt-1.5" />
                      )}
                    </div>

                    <div className="flex-1 pb-1">
                      <span className="text-sm font-medium text-black dark:text-white">
                        {getStepTitle(step, isStreaming)}
                      </span>

                      {step.type === 'reasoning' && (
                        <>
                          {step.reasoning && (
                            <p className="text-xs text-black/70 dark:text-white/70 mt-0.5">
                              {step.reasoning}
                            </p>
                          )}
                          {isStreaming && !step.reasoning && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div
                                className="w-1.5 h-1.5 bg-black/40 dark:bg-white/40 rounded-full animate-bounce"
                                style={{ animationDelay: '0ms' }}
                              />
                              <div
                                className="w-1.5 h-1.5 bg-black/40 dark:bg-white/40 rounded-full animate-bounce"
                                style={{ animationDelay: '150ms' }}
                              />
                              <div
                                className="w-1.5 h-1.5 bg-black/40 dark:bg-white/40 rounded-full animate-bounce"
                                style={{ animationDelay: '300ms' }}
                              />
                            </div>
                          )}
                        </>
                      )}

                      {step.type === 'searching' &&
                        Array.isArray(step.searching) &&
                        step.searching.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {step.searching.map((query, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-light-100 dark:bg-dark-100 text-black/70 dark:text-white/70 border border-light-200 dark:border-dark-200"
                              >
                                {query}
                              </span>
                            ))}
                          </div>
                        )}

                      {(step.type === 'search_results' ||
                        step.type === 'reading') &&
                        step.reading.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {step.reading.slice(0, 4).map((result, idx) => {
                              const url = result.metadata.url || '';
                              const title = result.metadata.title || 'Untitled';
                              const domain = url ? new URL(url).hostname : '';
                              const faviconUrl = domain
                                ? `https://s2.googleusercontent.com/s2/favicons?domain=${domain}&sz=128`
                                : '';

                              return (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-light-100 dark:bg-dark-100 text-black/70 dark:text-white/70 border border-light-200 dark:border-dark-200"
                                >
                                  {faviconUrl && (
                                    <img
                                      src={faviconUrl}
                                      alt=""
                                      className="w-3 h-3 rounded-sm flex-shrink-0"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  )}
                                  <span className="line-clamp-1">{title}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}

                      {step.type === 'upload_searching' &&
                        step.queries.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {step.queries.map((query, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-light-100 dark:bg-dark-100 text-black/70 dark:text-white/70 border border-light-200 dark:border-dark-200"
                              >
                                {query}
                              </span>
                            ))}
                          </div>
                        )}

                      {step.type === 'upload_search_results' &&
                        step.results.length > 0 && (
                          <div className="mt-1.5 grid gap-3 lg:grid-cols-3">
                            {step.results.slice(0, 4).map((result, idx) => {
                              const title =
                                (result.metadata &&
                                  (result.metadata.title ||
                                    result.metadata.fileName)) ||
                                'Untitled document';

                              return (
                                <div
                                  key={idx}
                                  className="flex flex-row space-x-3 rounded-lg border border-light-200 dark:border-dark-200 bg-light-100 dark:bg-dark-100 p-2 cursor-pointer"
                                >
                                  <div className="mt-0.5 h-10 w-10 rounded-md bg-cyan-100 text-cyan-800 dark:bg-sky-500 dark:text-cyan-50 flex items-center justify-center">
                                    <FileText className="w-5 h-5" />
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <p className="text-[13px] text-black dark:text-white line-clamp-1">
                                      {title}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssistantSteps;
