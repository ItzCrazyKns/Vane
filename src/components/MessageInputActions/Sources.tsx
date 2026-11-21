import { useChat } from '@/lib/hooks/useChat';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Switch,
} from '@headlessui/react';
import {
  CodeIcon,
  GlobeIcon,
  GraduationCapIcon,
  NetworkIcon,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';

const sourcesList = [
  {
    name: 'Web',
    key: 'web',
    icon: <GlobeIcon className="h-[16px] w-auto" />,
  },
  {
    name: 'Academic',
    key: 'academic',
    icon: <GraduationCapIcon className="h-[16px] w-auto" />,
  },
  {
    name: 'Social',
    key: 'discussions',
    icon: <NetworkIcon className="h-[16px] w-auto" />,
  },
  {
    name: 'Stack Overflow',
    key: 'stackoverflow',
    icon: <CodeIcon className="h-[16px] w-auto" />,
  },
];

const Sources = () => {
  const { sources, setSources } = useChat();

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <PopoverButton
            aria-label="Search sources"
            className="flex items-center justify-center active:border-none hover:bg-light-200 hover:dark:bg-dark-200 p-2 rounded-lg focus:outline-none text-black/50 dark:text-white/50 active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
          >
            <GlobeIcon className="h-[18px] w-auto" />
          </PopoverButton>
          <AnimatePresence>
            {open && (
              <PopoverPanel
                static
                anchor={{ to: 'bottom end', padding: 12 }}
                className="z-50 w-64 md:w-[225px]"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                  className="origin-top-right flex flex-col bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 w-full p-1 max-h-[200px] md:max-h-none overflow-y-auto shadow-lg"
                >
                  {sourcesList.map((source) => (
                    <Switch
                      key={source.key}
                      aria-label={source.name}
                      checked={sources.includes(source.key)}
                      className="group flex w-full flex-row justify-between hover:bg-light-100 hover:dark:bg-dark-100 rounded-md py-3 px-2 cursor-pointer"
                      onChange={(checked) => {
                        setSources(
                          checked
                            ? [...sources, source.key]
                            : sources.filter((s) => s !== source.key),
                        );
                      }}
                    >
                      <span className="flex flex-row space-x-1.5 text-black/80 dark:text-white/80">
                        {source.icon}
                        <span className="text-xs">{source.name}</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="relative flex h-4 w-7 shrink-0 rounded-full bg-light-200 dark:bg-white/10 p-0.5 duration-200 ease-in-out transition-colors group-data-[checked]:bg-sky-500 dark:group-data-[checked]:bg-sky-500"
                      >
                        <span className="pointer-events-none inline-block size-3 translate-x-[1px] group-data-[checked]:translate-x-3 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out" />
                      </span>
                    </Switch>
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

export default Sources;
