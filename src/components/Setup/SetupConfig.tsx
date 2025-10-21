import {
  ConfigModelProvider,
  UIConfigField,
  UIConfigSections,
} from '@/lib/config/types';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
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

    if (setupState === 2) {
      fetchProviders();
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

  const hasProviders = providers.length > 0;

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
                  Manage Providers
                </p>
                <p className="text-[10px] sm:text-xs text-black/50 dark:text-white/50 mt-0.5">
                  Add and configure your model providers
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
              ) : providers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                  <p className="text-xs sm:text-sm font-medium text-black/70 dark:text-white/70">
                    No providers configured
                  </p>
                </div>
              ) : (
                providers.map((provider) => (
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
                  Select models
                </p>
                <p className="text-[10px] sm:text-xs text-black/50 dark:text-white/50 mt-0.5">
                  Select models which you wish to use.
                </p>
              </div>
            </div>

            <div className="space-y-3 md:space-y-4">
              <ModelSelect providers={providers} type="chat" />
              <ModelSelect providers={providers} type="embedding" />
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex flex-row items-center justify-between pt-2">
        <a></a>
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
