import { useChat } from '@/lib/hooks/useChat';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import {
  GlobeIcon,
  CodeIcon,
  Pencil1Icon,
  ChevronDownIcon,
} from '@radix-ui/react-icons';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge, GraduationCap, Share2, Youtube } from 'lucide-react';

const focusModes = [
  {
    name: 'All',
    key: 'web',
    description: 'Search the entire internet',
    icon: <GlobeIcon className="h-4 w-4" />,
  },
  {
    name: 'Academic',
    key: 'academic',
    description: 'Search published academic papers',
    icon: <GraduationCap className="h-4 w-4" />,
  },
  {
    name: 'Writing',
    key: 'writing',
    description: 'Generate text without searching the web',
    icon: <Pencil1Icon className="h-4 w-4" />,
  },
  {
    name: 'Wolfram|Alpha',
    key: 'wolfram',
    description: 'Computational knowledge engine',
    icon: <Badge className="h-4 w-4" />,
  },
  {
    name: 'YouTube',
    key: 'youtube',
    description: 'Search and summarize videos',
    icon: <Youtube className="h-4 w-4" />,
  },
  {
    name: 'Reddit',
    key: 'reddit',
    description: 'Search discussions and opinions',
    icon: <Share2 className="h-4 w-4" />,
  },
];

const Focus = () => {
  const { sources, setSources } = useChat();

  // Logic to determine current "Focus" based on sources
  // Default is 'web' (All) if sources includes 'web' or is empty
  // If sources has 'academic', it is Academic, etc.
  // This is a simplification as Perplexica supports multiple sources, but Perplexity usually has one "Focus" mode.
  // We will toggle the single source for the focus mode, or 'web' for All.

  const currentFocusKey = focusModes.find(mode => sources.includes(mode.key))?.key || 'web';
  const currentFocus = focusModes.find(mode => mode.key === currentFocusKey);

  const handleFocusChange = (key: string) => {
    // If 'writing', we might clear all sources? Or keep it as a mode.
    // Perplexica 'sources' are usually for search.
    // Let's assume selecting a focus sets that as the ONLY source (Perplexity style).
    setSources([key]);
  };

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <PopoverButton className="flex flex-row items-center gap-1.5 text-xs font-medium text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors duration-200 outline-none">
            <span className="flex items-center gap-1">
               {currentFocus?.name || 'Focus'}
            </span>
            <ChevronDownIcon className={cn("h-3 w-3 transition-transform duration-200", open ? "rotate-180" : "")} />
          </PopoverButton>
          <AnimatePresence>
            {open && (
              <PopoverPanel
                static
                className="absolute bottom-full left-0 mb-2 z-20 w-48"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="flex flex-col bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-xl overflow-hidden p-1.5"
                >
                  {focusModes.map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => handleFocusChange(mode.key)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors duration-200",
                        currentFocusKey === mode.key
                          ? "bg-light-secondary dark:bg-dark-secondary text-black dark:text-white"
                          : "text-black/70 dark:text-white/70 hover:bg-light-100 dark:hover:bg-dark-100"
                      )}
                    >
                      <span className={cn(
                          "flex items-center justify-center",
                          currentFocusKey === mode.key ? "text-[#24A0ED]" : "text-black/50 dark:text-white/50"
                      )}>
                        {mode.icon}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{mode.name}</span>
                        {/* <span className="text-[10px] text-black/40 dark:text-white/40">{mode.description}</span> */}
                      </div>
                    </button>
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

export default Focus;
