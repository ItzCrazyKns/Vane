import { Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import { useChat } from '@/lib/hooks/useChat';
import { AnimatePresence, motion } from 'motion/react';

const effortLevels = [
  {
    key: 'low',
    title: 'Low',
    description: 'Minimal reasoning, fastest responses.',
  },
  {
    key: 'medium',
    title: 'Medium',
    description: 'Balanced reasoning depth and speed.',
  },
  {
    key: 'high',
    title: 'High',
    description: 'Deep reasoning for complex questions.',
  },
];

const Reasoning = () => {
  const { reasoningEnabled, setReasoningEnabled, reasoningEffort, setReasoningEffort } = useChat();

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <PopoverButton
            type="button"
            className={cn(
              'p-2 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary active:scale-95 transition duration-200 focus:outline-none',
              reasoningEnabled
                ? 'text-sky-500'
                : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white',
            )}
            title={reasoningEnabled ? 'Reasoning enabled' : 'Reasoning disabled'}
          >
            <Brain size={16} />
          </PopoverButton>
          <AnimatePresence>
            {open && (
              <PopoverPanel
                className="absolute z-10 w-56 left-0 bottom-full mb-2"
                static
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                  className="origin-bottom-left flex flex-col bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 w-full p-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setReasoningEnabled(!reasoningEnabled);
                      if (!reasoningEnabled && !reasoningEffort) {
                        setReasoningEffort('medium');
                      }
                    }}
                    className={cn(
                      'p-2 rounded-lg flex flex-row items-center justify-between text-start duration-200 cursor-pointer transition mb-1',
                      reasoningEnabled
                        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                        : 'hover:bg-light-secondary dark:hover:bg-dark-secondary text-black/70 dark:text-white/70',
                    )}
                  >
                    <div className="flex flex-row items-center space-x-2">
                      <Brain size={14} />
                      <p className="text-xs font-medium">Reasoning</p>
                    </div>
                    <div
                      className={cn(
                        'w-8 h-4 rounded-full transition-colors relative',
                        reasoningEnabled
                          ? 'bg-sky-500'
                          : 'bg-light-200 dark:bg-dark-200',
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
                          reasoningEnabled ? 'translate-x-4' : 'translate-x-0.5',
                        )}
                      />
                    </div>
                  </button>
                  {reasoningEnabled && (
                    <div className="flex flex-col space-y-1 mt-1">
                      <p className="text-[10px] text-black/40 dark:text-white/40 px-2 uppercase tracking-wide">
                        Effort
                      </p>
                      {effortLevels.map((level) => (
                        <button
                          type="button"
                          key={level.key}
                          onClick={() => setReasoningEffort(level.key)}
                          className={cn(
                            'p-2 rounded-lg flex flex-col items-start text-start duration-200 cursor-pointer transition',
                            reasoningEffort === level.key
                              ? 'bg-light-secondary dark:bg-dark-secondary'
                              : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                          )}
                        >
                          <p className="text-xs font-medium text-black dark:text-white">
                            {level.title}
                          </p>
                          <p className="text-[10px] text-black/50 dark:text-white/50">
                            {level.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              </PopoverPanel>
            )}
          </AnimatePresence>
        </>
      )}
    </Popover>
  );
};

export default Reasoning;
