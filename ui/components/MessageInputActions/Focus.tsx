import {
  BadgePercent,
  ChevronDown,
  Globe,
  Pencil,
  ScanEye,
  SwatchBook,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, Transition } from '@headlessui/react';
import { SiReddit, SiYoutube } from '@icons-pack/react-simple-icons';
import { Fragment } from 'react';

const focusModes = [
  {
    key: 'webSearch',
    title: 'All',
    description: 'Searches across all of the internet',
    icon: <Globe size={20} />,
  },
  {
    key: 'academicSearch',
    title: 'Academic',
    description: 'Search in published academic papers',
    icon: <SwatchBook size={20} />,
  },
  {
    key: 'writingAssistant',
    title: 'Writing',
    description: 'Chat without searching the web',
    icon: <Pencil size={16} />,
  },
  {
    key: 'wolframAlphaSearch',
    title: 'Wolfram Alpha',
    description: 'Computational knowledge engine',
    icon: <BadgePercent size={20} />,
  },
  {
    key: 'youtubeSearch',
    title: 'Youtube',
    description: 'Search and watch videos',
    icon: (
      <SiYoutube
        className="h-5 w-auto mr-0.5"
        onPointerEnterCapture={undefined}
        onPointerLeaveCapture={undefined}
      />
    ),
  },
  {
    key: 'redditSearch',
    title: 'Reddit',
    description: 'Search for discussions and opinions',
    icon: (
      <SiReddit
        className="h-5 w-auto mr-0.5"
        onPointerEnterCapture={undefined}
        onPointerLeaveCapture={undefined}
      />
    ),
  },
];

const Focus = ({
  focusMode,
  setFocusMode,
}: {
  focusMode: string;
  setFocusMode: (mode: string) => void;
}) => {
  return (
    <Popover className="fixed w-full max-w-[15rem] md:max-w-md lg:max-w-lg">
      <Popover.Button
        type="button"
        className="p-2 text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
      >
        {focusMode !== 'webSearch' ? (
          <div className="flex flex-row items-center space-x-1">
            {focusModes.find((mode) => mode.key === focusMode)?.icon}
            <p className="text-xs font-medium">
              {focusModes.find((mode) => mode.key === focusMode)?.title}
            </p>
            <ChevronDown size={20} />
          </div>
        ) : (
          <ScanEye />
        )}
      </Popover.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <Popover.Panel className="absolute z-10 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 w-full p-2 max-h-[200px] md:max-h-none overflow-y-auto">
            {focusModes.map((mode, i) => (
              <Popover.Button
                onClick={() => setFocusMode(mode.key)}
                key={i}
                className={cn(
                  'p-2 rounded-lg flex flex-col items-start justify-start text-start space-y-2 duration-200 cursor-pointer transition',
                  focusMode === mode.key
                    ? 'bg-light-secondary dark:bg-dark-secondary'
                    : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                )}
              >
                <div
                  className={cn(
                    'flex flex-row items-center space-x-1',
                    focusMode === mode.key
                      ? 'text-[#24A0ED]'
                      : 'text-black dark:text-white',
                  )}
                >
                  {mode.icon}
                  <p className="text-sm font-medium">{mode.title}</p>
                </div>
                <p className="text-black/70 dark:text-white/70 text-xs">
                  {mode.description}
                </p>
              </Popover.Button>
            ))}
          </div>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
};

export default Focus;
