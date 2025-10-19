import { Dialog, DialogPanel } from '@headlessui/react';
import { BrainCog, ChevronLeft, Search, Settings } from 'lucide-react';
import General from './Sections/General';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Loader from '../ui/Loader';
import { cn } from '@/lib/utils';
import Models from './Sections/Models/Section';
import SearchSection from './Sections/Search';

const sections = [
  {
    name: 'General',
    description: 'Adjust common settings.',
    icon: Settings,
    component: General,
    dataAdd: 'general',
  },
  {
    name: 'Models',
    description: 'Configure model settings.',
    icon: BrainCog,
    component: Models,
    dataAdd: 'modelProviders',
  },
  {
    name: 'Search',
    description: 'Manage search settings.',
    icon: Search,
    component: SearchSection,
    dataAdd: 'search',
  },
];

const SettingsDialogue = ({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (active: boolean) => void;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [activeSection, setActiveSection] = useState(sections[0]);

  useEffect(() => {
    if (isOpen) {
      const fetchConfig = async () => {
        try {
          const res = await fetch('/api/config', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const data = await res.json();

          setConfig(data);
        } catch (error) {
          console.error('Error fetching config:', error);
          toast.error('Failed to load configuration.');
        } finally {
          setIsLoading(false);
        }
      };

      fetchConfig();
    }
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onClose={() => setIsOpen(false)}
      className="relative z-50"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        className="fixed inset-0 flex w-screen items-center justify-center p-4 bg-black/30 backdrop-blur-sm h-screen"
      >
        <DialogPanel className="space-y-4 border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary backdrop-blur-lg rounded-xl h-[calc(100vh-2%)] w-[calc(100vw-2%)] md:h-[calc(100vh-7%)] md:w-[calc(100vw-7%)] lg:h-[calc(100vh-20%)] lg:w-[calc(100vw-30%)]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full w-full">
              <Loader />
            </div>
          ) : (
            <div className="flex flex-1 inset-0 h-full">
              <div className="w-[240px] border-r border-white-200 dark:border-dark-200 h-full px-3 pt-3 flex flex-col">
                <button
                  onClick={() => setIsOpen(false)}
                  className="group flex flex-row items-center hover:bg-light-200 hover:dark:bg-dark-200 p-2 rounded-lg"
                >
                  <ChevronLeft
                    size={18}
                    className="text-black/50 dark:text-white/50 group-hover:text-black/70 group-hover:dark:text-white/70"
                  />
                  <p className="text-black/50 dark:text-white/50 group-hover:text-black/70 group-hover:dark:text-white/70 text-[14px]">
                    Back
                  </p>
                </button>
                <div className="flex flex-col items-start space-y-1 mt-8">
                  {sections.map((section) => (
                    <button
                      key={section.dataAdd}
                      className={cn(
                        `flex flex-row items-center space-x-2 px-2 py-1.5 rounded-lg w-full text-sm hover:bg-light-200 hover:dark:bg-dark-200 transition duration-200 active:scale-95`,
                        activeSection.name === section.name
                          ? 'bg-light-200 dark:bg-dark-200 text-black/90 dark:text-white/90'
                          : ' text-black/70 dark:text-white/70',
                      )}
                      onClick={() => setActiveSection(section)}
                    >
                      <section.icon size={17} />
                      <p>{section.name}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-full">
                {activeSection.component && (
                  <div className="flex h-full flex-col">
                    <div className="border-b border-light-200/60 px-6 pb-6 pt-8 dark:border-dark-200/60">
                      <div className="flex flex-col">
                        <h4 className="font-medium text-black dark:text-white">
                          {activeSection.name}
                        </h4>
                        <p className="text-xs text-black/50 dark:text-white/50">
                          {activeSection.description}
                        </p>
                      </div>
                    </div>
                    <activeSection.component
                      fields={config.fields[activeSection.dataAdd]}
                      values={config.values[activeSection.dataAdd]}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogPanel>
      </motion.div>
    </Dialog>
  );
};

export default SettingsDialogue;
