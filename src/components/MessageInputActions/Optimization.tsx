import { ChevronDown, Sliders, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel
} from '@headlessui/react';
import { useChat } from '@/lib/hooks/useChat';
import { AnimatePresence, motion } from 'motion/react';

const OptimizationModes = [
  {
    key: 'speed',
    title: 'Speed',
    description: 'Prioritize speed and get the quickest possible answer.',
    icon: <Zap size={16} className="text-[#FF9800]" />,
  },
  {
    key: 'balanced',
    title: 'Balanced',
    description: 'Find the right balance between speed and accuracy',
    icon: <Sliders size={16} className="text-[#4CAF50]" />,
  },
  {
    key: 'quality',
    title: 'Quality',
    description: 'Get the most thorough and accurate answer',
    icon: (
      <Star
        size={16}
        className="text-[#2196F3] dark:text-[#BBDEFB] fill-[#BBDEFB] dark:fill-[#2196F3]"
      />
    ),
  },
];

const Optimization = () => {
  const { optimizationMode, setOptimizationMode } = useChat();

  return (
    <Popover className="relative w-full max-w-60 md:max-w-md lg:max-w-lg">
      {({ open }) => (
        <>
          <PopoverButton
            type="button"
            className="p-2 text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary active:scale-95 transition duration-200 hover:text-black dark:hover:text-white focus:outline-none"
          >
            <div className="flex flex-row items-center space-x-1">
              {
                OptimizationModes.find((mode) => mode.key === optimizationMode)
                  ?.icon
              }
              <ChevronDown
                size={16}
                className={cn(
                  open ? 'rotate-180' : 'rotate-0',
                  'transition duration:200',
                )}
              />
            </div>
          </PopoverButton>
          <AnimatePresence>
            {open && (
              <PopoverPanel
                className="absolute z-10 w-64 md:w-62.5 left-0"
                static
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                  className="origin-top-left flex flex-col space-y-2 bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 w-full p-2 max-h-50 md:max-h-none overflow-y-auto"
                >
                  {OptimizationModes.map((mode, i) => (
                    <PopoverButton
                      onClick={() => setOptimizationMode(mode.key)}
                      key={i}
                      className={cn(
                        'p-2 rounded-lg flex flex-col items-start justify-start text-start space-y-1 duration-200 cursor-pointer transition focus:outline-none',
                        optimizationMode === mode.key
                          ? 'bg-light-secondary dark:bg-dark-secondary'
                          : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                      )}
                    >
                      <div className="flex flex-row justify-between w-full text-black dark:text-white">
                        <div className="flex flex-row space-x-1">
                          {mode.icon}
                          <p className="text-xs font-medium">{mode.title}</p>
                        </div>
                        {mode.key === 'quality' && (
                          <span className="bg-sky-500/70 dark:bg-sky-500/40 border border-sky-600 px-1 rounded-full text-[10px] text-white">
                            Beta
                          </span>
                        )}
                      </div>
                      <p className="text-black/70 dark:text-white/70 text-xs">
                        {mode.description}
                      </p>
                    </PopoverButton>
                  ))}
                </motion.div>
              </PopoverPanel>
            )}
          </AnimatePresence>
        </>
      )}
    </Popover>
  );
};

export default Optimization;
