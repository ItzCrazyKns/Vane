import { Dialog, DialogPanel } from '@headlessui/react';
import {
  ArrowLeft,
  BrainCog,
  ChevronLeft,
  ExternalLink,
  Gauge,
  Network,
  Search,
  Sliders,
  ToggleRight,
} from 'lucide-react';
import Preferences from './Sections/Preferences';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Loader from '../ui/Loader';
import { cn } from '@/lib/utils';
import Models from './Sections/Models/Section';
import SearchSection from './Sections/Search';
import BifrostSection from './Sections/Bifrost';
import BenchmarkSection from './Sections/Benchmark';
import Select from '@/components/ui/Select';
import Personalization from './Sections/Personalization';
import { useTranslations } from 'next-intl';

const sections = [
  {
    key: 'preferences',
    icon: Sliders,
    component: Preferences,
    dataAdd: 'preferences',
  },
  {
    key: 'personalization',
    icon: ToggleRight,
    component: Personalization,
    dataAdd: 'personalization',
  },
  {
    key: 'models',
    icon: BrainCog,
    component: Models,
    dataAdd: 'modelProviders',
  },
  {
    key: 'search',
    icon: Search,
    component: SearchSection,
    dataAdd: 'search',
  },
  {
    key: 'bifrost',
    icon: Network,
    component: BifrostSection,
    dataAdd: 'bifrost',
  },
  {
    key: 'benchmark',
    icon: Gauge,
    component: BenchmarkSection,
    dataAdd: 'benchmark',
  },
] as const;

const SettingsDialogue = ({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (active: boolean) => void;
}) => {
  const t = useTranslations('Settings');
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [configVersion, setConfigVersion] = useState(0);
  const [activeSection, setActiveSection] = useState<
    (typeof sections)[number]['key']
  >(sections[0].key);
  const selectedSection =
    sections.find((s) => s.key === activeSection) ?? sections[0];

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
          setConfigVersion((v) => v + 1);
        } catch (error) {
          console.error('Error fetching config:', error);
          toast.error(t('loadError'));
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
        <DialogPanel className="space-y-4 border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary backdrop-blur-lg rounded-xl h-[calc(100vh-2%)] w-[calc(100vw-2%)] md:h-[calc(100vh-7%)] md:w-[calc(100vw-7%)] lg:h-[calc(100vh-20%)] lg:w-[calc(100vw-30%)] overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center h-full w-full">
              <Loader />
            </div>
          ) : (
            <div className="flex flex-1 inset-0 h-full overflow-hidden">
              <div className="hidden lg:flex flex-col justify-between w-[240px] border-r border-white-200 dark:border-dark-200 h-full px-3 pt-3 overflow-y-auto">
                <div className="flex flex-col">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="group flex flex-row items-center hover:bg-light-200 hover:dark:bg-dark-200 p-2 rounded-lg"
                  >
                    <ChevronLeft
                      size={18}
                      className="text-black/50 dark:text-white/50 group-hover:text-black/70 group-hover:dark:text-white/70"
                    />
                    <p className="text-black/50 dark:text-white/50 group-hover:text-black/70 group-hover:dark:text-white/70 text-[14px]">
                      {t('back')}
                    </p>
                  </button>

                  <div className="flex flex-col items-start space-y-1 mt-8">
                    {sections.map((section) => (
                      <button
                        key={section.dataAdd}
                        className={cn(
                          `flex flex-row items-center space-x-2 px-2 py-1.5 rounded-lg w-full text-sm hover:bg-light-200 hover:dark:bg-dark-200 transition duration-200 active:scale-95`,
                          activeSection === section.key
                            ? 'bg-light-200 dark:bg-dark-200 text-black/90 dark:text-white/90'
                            : ' text-black/70 dark:text-white/70',
                        )}
                        onClick={() => setActiveSection(section.key)}
                      >
                        <section.icon size={17} />
                        <p>{t(`sections.${section.key}.name`)}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col space-y-1 py-[18px] px-2">
                  <p className="text-xs text-black/70 dark:text-white/70">
                    {t('version', {
                      version: process.env.NEXT_PUBLIC_VERSION ?? '',
                    })}
                  </p>
                  <a
                    href="https://github.com/module195/Vane"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-black/70 dark:text-white/70 flex flex-row space-x-1 items-center transition duration-200 hover:text-black/90 hover:dark:text-white/90"
                  >
                    <span>GitHub</span>
                    <ExternalLink size={12} />
                  </a>
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
                        label: t(`sections.${section.key}.name`),
                      };
                    })}
                    value={activeSection}
                    onChange={(e) => {
                      setActiveSection(
                        e.target.value as (typeof sections)[number]['key'],
                      );
                    }}
                    className="!text-xs lg:!text-sm"
                  />
                </div>
                {selectedSection.component && (
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <div className="border-b border-light-200/60 px-6 pb-6 lg:pt-6 dark:border-dark-200/60 flex-shrink-0">
                      <div className="flex flex-col">
                        <h4 className="font-medium text-black dark:text-white text-sm lg:text-sm">
                          {t(`sections.${selectedSection.key}.name`)}
                        </h4>
                        <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
                          {t(`sections.${selectedSection.key}.description`)}
                        </p>
                      </div>
                    </div>
                    {/* Every section stays mounted and only the active one is
                        shown. Each field keeps what the user saved in its own
                        state, and config is only fetched when the dialog
                        opens, so remounting a section on a tab switch would
                        show the values from that fetch, not the saved ones.
                        The key remounts them with the values of each new
                        fetch (reopening the dialog). */}
                    <div
                      key={configVersion}
                      className="flex-1 flex flex-col overflow-hidden"
                    >
                      {sections.map((section) => (
                        <div
                          key={section.key}
                          hidden={section.key !== selectedSection.key}
                          className="flex-1 overflow-y-auto"
                        >
                          <section.component
                            fields={config.fields[section.dataAdd]}
                            values={config.values[section.dataAdd]}
                          />
                        </div>
                      ))}
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
