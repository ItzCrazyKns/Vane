import { Dialog, DialogPanel } from '@headlessui/react';
import {
  ArrowLeft,
  BrainCog,
  ChevronLeft,
  ExternalLink,
  Search,
  Sliders,
  ToggleRight,
} from 'lucide-react';
import Preferences from './Sections/Preferences';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Loader from '../ui/Loader';
import { cn } from '@/lib/utils';
import Models from './Sections/Models/Section';
import SearchSection from './Sections/Search';
import Select from '@/components/ui/Select';
import Personalization from './Sections/Personalization';

const sections = [
  {
    key: 'preferences',
    name: 'Preferences',
    description: 'Customize your application preferences.',
    icon: Sliders,
    component: Preferences,
    dataAdd: 'preferences',
  },
  {
    key: 'personalization',
    name: 'Personalization',
    description: 'Customize the behavior and tone of the model.',
    icon: ToggleRight,
    component: Personalization,
    dataAdd: 'personalization',
  },
  {
    key: 'models',
    name: 'Models',
    description: 'Connect to AI services and manage connections.',
    icon: BrainCog,
    component: Models,
    dataAdd: 'modelProviders',
  },
  {
    key: 'search',
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
  const [activeSection, setActiveSection] = useState<string>(sections[0].key);
  const [selectedSection, setSelectedSection] = useState(sections[0]);

  useEffect(() => {
    setSelectedSection(sections.find((s) => s.key === activeSection)!);
  }, [activeSection]);

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
        <DialogPanel className="space-y-4 border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary backdrop-blur-lg rounded-2xl shadow-2xl h-[calc(100vh-2%)] w-[calc(100vw-2%)] md:h-[calc(100vh-5%)] md:w-[calc(100vw-5%)] lg:h-[calc(100vh-10%)] lg:w-[calc(100vw-20%)] overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center h-full w-full">
              <Loader />
            </div>
          ) : (
            <div className="flex flex-1 inset-0 h-full overflow-hidden">
              <div className="hidden lg:flex flex-col justify-between w-[260px] border-r border-light-200 dark:border-dark-200 h-full bg-light-secondary/30 dark:bg-dark-secondary/30">
                <div className="flex flex-col p-4">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="group flex flex-row items-center gap-2 mb-6 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors"
                  >
                    <div className="p-1 rounded-md group-hover:bg-light-200 dark:group-hover:bg-dark-200 transition-colors">
                      <ChevronLeft size={18} />
                    </div>
                    <span className="text-sm font-medium">Settings</span>
                  </button>

                  <div className="flex flex-col space-y-1">
                    {sections.map((section) => (
                      <button
                        key={section.dataAdd}
                        className={cn(
                          `flex flex-row items-center gap-3 px-3 py-2.5 rounded-xl w-full text-sm font-medium transition-all duration-200`,
                          activeSection === section.key
                            ? 'bg-white dark:bg-dark-secondary text-black dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                            : 'text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5',
                        )}
                        onClick={() => setActiveSection(section.key)}
                      >
                        <section.icon size={18} className={cn(activeSection === section.key ? "text-[#24A0ED]" : "opacity-70")} />
                        <span>{section.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4 border-t border-light-200 dark:border-dark-200 bg-light-secondary/50 dark:bg-dark-secondary/50">
                  <div className="flex items-center justify-between text-xs text-black/50 dark:text-white/50">
                    <span>v{process.env.NEXT_PUBLIC_VERSION}</span>
                    <a
                      href="https://github.com/itzcrazykns/perplexica"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-black dark:hover:text-white transition-colors"
                    >
                      GitHub <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </div>
              <div className="w-full flex flex-col overflow-hidden">
                <div className="flex flex-row lg:hidden w-full justify-between px-[20px] my-4 flex-shrink-0">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="group flex flex-row items-center hover:bg-light-200 hover:dark:bg-dark-200 rounded-lg mr-[40%]"
                  >
                    <ArrowLeft
                      size={18}
                      className="text-black/50 dark:text-white/50 group-hover:text-black/70 group-hover:dark:text-white/70"
                    />
                  </button>
                  <Select
                    options={sections.map((section) => {
                      return {
                        value: section.key,
                        key: section.key,
                        label: section.name,
                      };
                    })}
                    value={activeSection}
                    onChange={(e) => {
                      setActiveSection(e.target.value);
                    }}
                    className="!text-xs lg:!text-sm"
                  />
                </div>
                {selectedSection.component && (
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <div className="border-b border-light-200/60 px-6 pb-6 lg:pt-6 dark:border-dark-200/60 flex-shrink-0">
                      <div className="flex flex-col">
                        <h4 className="font-medium text-black dark:text-white text-sm lg:text-sm">
                          {selectedSection.name}
                        </h4>
                        <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
                          {selectedSection.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <selectedSection.component
                        fields={config.fields[selectedSection.dataAdd]}
                        values={config.values[selectedSection.dataAdd]}
                      />
                    </div>
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
