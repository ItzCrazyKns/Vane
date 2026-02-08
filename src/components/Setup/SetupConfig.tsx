import {
  ConfigModelProvider,
  UIConfigField,
  UIConfigSections,
} from '@/lib/config/types';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Copy, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AddProvider from '../Settings/Sections/Models/AddProviderDialog';
import ModelProvider from '../Settings/Sections/Models/ModelProvider';
import ModelSelect from '@/components/Settings/Sections/Models/ModelSelect';

const SetupConfig = ({
  configSections,
  setupState,
  setSetupState,
}: {
  configSections: UIConfigSections;
  setupState: number;
  setSetupState: (state: number) => void;
}) => {
  const [providers, setProviders] = useState<ConfigModelProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [envVars, setEnvVars] = useState<string[]>([]);
  const [searxngURL, setSearxngURL] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/providers');
        if (!res.ok) throw new Error('Failed to fetch providers');

        const data = await res.json();
        setProviders(data.providers || []);
      } catch (error) {
        console.error('Error fetching providers:', error);
        toast.error('Failed to load providers');
      } finally {
        setIsLoading(false);
      }
    };

    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          setSearxngURL(data.values.search.searxngURL || '');
        }
      } catch (err) {
        console.error('Error fetching config:', err);
      }
    };

    if (setupState === 2) {
      fetchProviders();
    }
    if (setupState === 3) {
      fetchConfig();
    }
  }, [setupState]);

  useEffect(() => {
    const fetchEnvVars = async () => {
      try {
        const res = await fetch('/api/config/env-vars');
        if (!res.ok) throw new Error('Failed to fetch env vars');

        const data = await res.json();
        setEnvVars(data.envVars || []);
      } catch (error) {
        console.error('Error fetching env vars:', error);
      }
    };

    if (setupState === 4) {
      fetchEnvVars();
    }
  }, [setupState]);

  const handleFinish = async () => {
    try {
      setIsFinishing(true);
      const res = await fetch('/api/config/setup-complete', {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to complete setup');

      window.location.reload();
    } catch (error) {
      console.error('Error completing setup:', error);
      toast.error('Failed to complete setup');
      setIsFinishing(false);
    }
  };

  const handleSearxngURLChange = async (newURL: string) => {
    setSearxngURL(newURL);
    try {
      await fetch('/api/config', {
        method: 'POST',
        body: JSON.stringify({
          key: 'search.searxngURL',
          value: newURL,
        }),
      });
    } catch (err) {
      console.error('Error saving SearXNG URL:', err);
    }
  };

  const visibleProviders = providers.filter(
    (p) => p.name.toLowerCase() !== 'transformers',
  );
  const hasProviders =
    visibleProviders.filter((p) => p.chatModels.length > 0).length > 0;

  const copyToClipboard = () => {
    const text = envVars.join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="w-[95vw] md:w-[80vw] lg:w-[65vw] mx-auto px-2 sm:px-4 md:px-6 flex flex-col space-y-6">
      {setupState === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, delay: 0.1 },
          }}
          className="w-full h-[calc(95vh-80px)] bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-sm flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 md:py-6">
            <div className="flex flex-row justify-between items-center mb-4 md:mb-6 pb-3 md:pb-4 border-b border-light-200 dark:border-dark-200">
              <div>
                <p className="text-xs sm:text-sm font-medium text-black dark:text-white">
                  Manage Connections
                </p>
                <p className="text-[10px] sm:text-xs text-black/50 dark:text-white/50 mt-0.5">
                  Add connections to access AI models
                </p>
              </div>
              <AddProvider
                modelProviders={configSections.modelProviders}
                setProviders={setProviders}
              />
            </div>

            <div className="space-y-3 md:space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 md:py-12">
                  <p className="text-xs sm:text-sm text-black/50 dark:text-white/50">
                    Loading providers...
                  </p>
                </div>
              ) : visibleProviders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                  <p className="text-xs sm:text-sm font-medium text-black/70 dark:text-white/70">
                    No connections configured
                  </p>
                  <p className="text-[10px] sm:text-xs text-black/50 dark:text-white/50 mt-1">
                    Click &quot;Add Connection&quot; above to get started
                  </p>
                </div>
              ) : (
                visibleProviders.map((provider) => (
                  <ModelProvider
                    key={`provider-${provider.id}`}
                    fields={
                      (configSections.modelProviders.find(
                        (f) => f.key === provider.type,
                      )?.fields ?? []) as UIConfigField[]
                    }
                    modelProvider={provider}
                    setProviders={setProviders}
                  />
                ))
              )}
            </div>
          </div>
        </motion.div>
      )}

      {setupState === 3 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, delay: 0.1 },
          }}
          className="w-full h-[calc(95vh-80px)] bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-sm flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 md:py-6">
            <div className="flex flex-row justify-between items-center mb-4 md:mb-6 pb-3 md:pb-4 border-b border-light-200 dark:border-dark-200">
              <div>
                <p className="text-xs sm:text-sm font-medium text-black dark:text-white">
                  Search & Models
                </p>
                <p className="text-[10px] sm:text-xs text-black/50 dark:text-white/50 mt-0.5">
                  Configure your search engine and default models.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
                <div className="space-y-3 lg:space-y-5">
                  <div>
                    <h4 className="text-sm lg:text-sm text-black dark:text-white">
                      SearXNG URL
                    </h4>
                    <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
                      Enter the base URL of your SearXNG instance (e.g.,
                      http://localhost:8080)
                    </p>
                  </div>
                  <div className="flex items-center relative">
                    <Search className="absolute left-3 w-4 h-4 text-black/40 dark:text-white/40" />
                    <input
                      type="text"
                      placeholder="http://localhost:8080"
                      value={searxngURL}
                      onChange={(e) => handleSearxngURLChange(e.target.value)}
                      className="w-full bg-light-secondary dark:bg-dark-secondary text-black dark:text-white text-xs lg:text-[13px] rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-[#24A0ED] border border-light-200 dark:border-dark-200 transition-all"
                    />
                  </div>
                </div>
              </section>

              <div className="space-y-3 md:space-y-4">
                <ModelSelect providers={providers} type="chat" />
                <ModelSelect providers={providers} type="embedding" />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {setupState === 4 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, delay: 0.1 },
          }}
          className="w-full h-[calc(95vh-80px)] bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-sm flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 md:py-6">
            <div className="flex flex-row justify-between items-center mb-4 md:mb-6 pb-3 md:pb-4 border-b border-light-200 dark:border-dark-200">
              <div>
                <p className="text-xs sm:text-sm font-medium text-black dark:text-white">
                  Docker Configuration (Optional)
                </p>
                <p className="text-[10px] sm:text-xs text-black/50 dark:text-white/50 mt-0.5">
                  If dploying using Docker, Copy these environment variables to your docker-compose.yaml
                  file for added convenience and portability.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {copied && (
                  <span className="text-[10px] sm:text-xs font-medium text-green-500 animate-in fade-in slide-in-from-right-1 duration-200">
                    Copied!
                  </span>
                )}
                <button
                  onClick={copyToClipboard}
                  className="p-2 hover:bg-light-200 dark:hover:bg-dark-200 rounded-lg transition-colors relative"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-black/50 dark:text-white/50" />
                  )}
                </button>
              </div>
            </div>

            <div className="bg-light-secondary dark:bg-dark-secondary p-4 rounded-lg overflow-x-auto border border-light-200 dark:border-dark-200">
              <pre className="text-[10px] sm:text-xs text-black/70 dark:text-white/70 whitespace-pre font-mono">
                {envVars.join('\n')}
              </pre>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex flex-row items-center justify-between pt-2">
        {setupState > 2 ? (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{
              opacity: 1,
              x: 0,
              transition: { duration: 0.5 },
            }}
            onClick={() => {
              setSetupState(setupState - 1);
            }}
            className="flex flex-row items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-lg bg-light-200 dark:bg-dark-200 text-black dark:text-white hover:bg-light-300 dark:hover:bg-dark-300 active:scale-95 transition-all duration-200 font-medium text-xs sm:text-sm"
          >
            <ArrowLeft className="w-4 h-4 md:w-[18px] md:h-[18px]" />
            <span>Back</span>
          </motion.button>
        ) : (
          <a></a>
        )}
        {setupState === 2 && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{
              opacity: 1,
              x: 0,
              transition: { duration: 0.5 },
            }}
            onClick={() => {
              setSetupState(3);
            }}
            disabled={!hasProviders || isLoading}
            className="flex flex-row items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-lg bg-[#24A0ED] text-white hover:bg-[#1e8fd1] active:scale-95 transition-all duration-200 font-medium text-xs sm:text-sm disabled:bg-light-200 dark:disabled:bg-dark-200 disabled:text-black/40 dark:disabled:text-white/40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <span>Next</span>
            <ArrowRight className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </motion.button>
        )}
        {setupState === 3 && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{
              opacity: 1,
              x: 0,
              transition: { duration: 0.5 },
            }}
            onClick={() => {
              setSetupState(4);
            }}
            disabled={!hasProviders || isLoading || !searxngURL}
            className="flex flex-row items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-lg bg-[#24A0ED] text-white hover:bg-[#1e8fd1] active:scale-95 transition-all duration-200 font-medium text-xs sm:text-sm disabled:bg-light-200 dark:disabled:bg-dark-200 disabled:text-black/40 dark:disabled:text-white/40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <span>Next</span>
            <ArrowRight className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </motion.button>
        )}
        {setupState === 4 && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{
              opacity: 1,
              x: 0,
              transition: { duration: 0.5 },
            }}
            onClick={handleFinish}
            disabled={!hasProviders || isLoading || isFinishing}
            className="flex flex-row items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-lg bg-[#24A0ED] text-white hover:bg-[#1e8fd1] active:scale-95 transition-all duration-200 font-medium text-xs sm:text-sm disabled:bg-light-200 dark:disabled:bg-dark-200 disabled:text-black/40 dark:disabled:text-white/40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <span>{isFinishing ? 'Finishing...' : 'Finish'}</span>
            <Check className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default SetupConfig;

