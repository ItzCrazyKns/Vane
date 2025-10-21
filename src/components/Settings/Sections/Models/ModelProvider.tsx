import { UIConfigField, ConfigModelProvider } from '@/lib/config/types';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ChevronDown, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import AddModel from './AddModelDialog';
import UpdateProvider from './UpdateProviderDialog';
import DeleteProvider from './DeleteProviderDialog';

const ModelProvider = ({
  modelProvider,
  setProviders,
  fields,
}: {
  modelProvider: ConfigModelProvider;
  fields: UIConfigField[];
  setProviders: React.Dispatch<React.SetStateAction<ConfigModelProvider[]>>;
}) => {
  const [open, setOpen] = useState(false);

  const handleModelDelete = async (
    type: 'chat' | 'embedding',
    modelKey: string,
  ) => {
    try {
      const res = await fetch(`/api/providers/${modelProvider.id}/models`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: modelKey, type: type }),
      });

      if (!res.ok) {
        throw new Error('Failed to delete model: ' + (await res.text()));
      }

      setProviders(
        (prev) =>
          prev.map((provider) => {
            if (provider.id === modelProvider.id) {
              return {
                ...provider,
                ...(type === 'chat'
                  ? {
                      chatModels: provider.chatModels.filter(
                        (m) => m.key !== modelKey,
                      ),
                    }
                  : {
                      embeddingModels: provider.embeddingModels.filter(
                        (m) => m.key !== modelKey,
                      ),
                    }),
              };
            }
            return provider;
          }) as ConfigModelProvider[],
      );

      toast.success('Model deleted successfully.');
    } catch (err) {
      console.error('Failed to delete model', err);
      toast.error('Failed to delete model.');
    }
  };

  return (
    <div
      key={modelProvider.id}
      className="border border-light-200 dark:border-dark-200 rounded-lg overflow-hidden"
    >
      <div
        className={cn(
          'group px-5 py-4 flex flex-row justify-between w-full cursor-pointer hover:bg-light-secondary hover:dark:bg-dark-secondary transition duration-200 items-center',
          !open && 'rounded-lg',
        )}
        onClick={() => setOpen(!open)}
      >
        <p className="text-sm lg:text-base text-black dark:text-white font-medium">
          {modelProvider.name}
        </p>
        <div className="flex items-center gap-4">
          <div className="flex flex-row items-center">
            <UpdateProvider
              fields={fields}
              modelProvider={modelProvider}
              setProviders={setProviders}
            />
            <DeleteProvider
              modelProvider={modelProvider}
              setProviders={setProviders}
            />
          </div>
          <ChevronDown
            size={16}
            className={cn(
              open ? 'rotate-180' : '',
              'transition duration-200 text-black/70 dark:text-white/70 group-hover:text-sky-500',
            )}
          />
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            <div className="border-t border-light-200 dark:border-dark-200" />
            <div className="flex flex-col gap-y-4 px-5 py-4">
              <div className="flex flex-col gap-y-2">
                <div className="flex flex-row w-full justify-between items-center">
                  <p className="text-[11px] lg:text-xs text-black/70 dark:text-white/70">
                    Chat models
                  </p>
                  <AddModel
                    providerId={modelProvider.id}
                    setProviders={setProviders}
                    type="chat"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  {modelProvider.chatModels.some((m) => m.key === 'error') ? (
                    <div className="flex flex-row items-center gap-2 text-xs lg:text-sm text-red-500 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2 border border-red-200 dark:border-red-900/30">
                      <AlertCircle size={16} className="shrink-0" />
                      <span className="break-words">
                        {
                          modelProvider.chatModels.find(
                            (m) => m.key === 'error',
                          )?.name
                        }
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-row flex-wrap gap-2">
                      {modelProvider.chatModels.map((model, index) => (
                        <div
                          key={`${modelProvider.id}-chat-${model.key}-${index}`}
                          className="flex flex-row items-center space-x-1 text-xs lg:text-sm text-black/70 dark:text-white/70 rounded-lg bg-light-secondary dark:bg-dark-secondary px-3 py-1.5"
                        >
                          <span>{model.name}</span>
                          <button
                            onClick={() => {
                              handleModelDelete('chat', model.key);
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-y-2">
                <div className="flex flex-row w-full justify-between items-center">
                  <p className="text-[11px] lg:text-xs text-black/70 dark:text-white/70">
                    Embedding models
                  </p>
                  <AddModel
                    providerId={modelProvider.id}
                    setProviders={setProviders}
                    type="embedding"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  {modelProvider.embeddingModels.some(
                    (m) => m.key === 'error',
                  ) ? (
                    <div className="flex flex-row items-center gap-2 text-xs lg:text-sm text-red-500 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2 border border-red-200 dark:border-red-900/30">
                      <AlertCircle size={16} className="shrink-0" />
                      <span className="break-words">
                        {
                          modelProvider.embeddingModels.find(
                            (m) => m.key === 'error',
                          )?.name
                        }
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-row flex-wrap gap-2">
                      {modelProvider.embeddingModels.map((model, index) => (
                        <div
                          key={`${modelProvider.id}-embedding-${model.key}-${index}`}
                          className="flex flex-row items-center space-x-1 text-xs lg:text-sm text-black/70 dark:text-white/70 rounded-lg bg-light-secondary dark:bg-dark-secondary px-3 py-1.5"
                        >
                          <span>{model.name}</span>
                          <button
                            onClick={() => {
                              handleModelDelete('embedding', model.key);
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModelProvider;
