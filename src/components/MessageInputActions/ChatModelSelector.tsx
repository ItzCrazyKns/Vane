'use client';

import { Cpu, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { MinimalProvider } from '@/lib/models/types';
import { useChat } from '@/lib/hooks/useChat';

const ModelSelector = () => {
  const [providers, setProviders] = useState<MinimalProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const { setChatModelProvider, chatModelProvider } = useChat();

  useEffect(() => {
    const loadProviders = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/providers');

        if (!res.ok) {
          throw new Error('Failed to fetch providers');
        }

        const data: { providers: MinimalProvider[] } = await res.json();
        setProviders(data.providers);
      } catch (error) {
        console.error('Error loading providers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProviders();
  }, []);

  const orderedProviders = useMemo(() => {
    if (!chatModelProvider?.providerId) return providers;

    const currentProviderIndex = providers.findIndex(
      (p) => p.id === chatModelProvider.providerId,
    );

    if (currentProviderIndex === -1) {
      return providers;
    }

    const selectedProvider = providers[currentProviderIndex];
    const remainingProviders = providers.filter(
      (_, index) => index !== currentProviderIndex,
    );

    return [selectedProvider, ...remainingProviders];
  }, [providers, chatModelProvider]);

  const handleModelSelect = (providerId: string, modelKey: string) => {
    setChatModelProvider({ providerId, key: modelKey });
    localStorage.setItem('chatModelProviderId', providerId);
    localStorage.setItem('chatModelKey', modelKey);
  };

  const filteredProviders = orderedProviders
    .map((provider) => ({
      ...provider,
      chatModels: provider.chatModels.filter(
        (model) =>
          model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          provider.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter((provider) => provider.chatModels.length > 0);

  return (
    <Popover className="relative w-full max-w-[15rem] md:max-w-md lg:max-w-lg">
      <PopoverButton
        type="button"
        className="active:border-none hover:bg-light-200  hover:dark:bg-dark-200 p-2 rounded-lg focus:outline-none headless-open:text-black dark:headless-open:text-white text-black/50 dark:text-white/50 active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
      >
        <Cpu size={16} className="text-sky-500" />
      </PopoverButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel className="absolute z-10 w-[230px] sm:w-[270px] md:w-[300px] -right-4">
          <div className="bg-light-primary dark:bg-dark-primary max-h-[300px] sm:max-w-none border rounded-lg border-light-200 dark:border-dark-200 w-full flex flex-col shadow-lg overflow-hidden">
            <div className="p-4 border-b border-light-200 dark:border-dark-200">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40"
                />
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-light-secondary dark:bg-dark-secondary rounded-lg placeholder:text-sm text-sm text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 border border-transparent focus:border-sky-500/30 transition duration-200"
                />
              </div>
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2
                    className="animate-spin text-black/40 dark:text-white/40"
                    size={24}
                  />
                </div>
              ) : filteredProviders.length === 0 ? (
                <div className="text-center py-16 px-4 text-black/60 dark:text-white/60 text-sm">
                  {searchQuery
                    ? 'No models found'
                    : 'No chat models configured'}
                </div>
              ) : (
                <div className="flex flex-col">
                  {filteredProviders.map((provider, providerIndex) => (
                    <div key={provider.id}>
                      <div className="px-4 py-2.5 sticky top-0 bg-light-primary dark:bg-dark-primary border-b border-light-200/50 dark:border-dark-200/50">
                        <p className="text-xs text-black/50 dark:text-white/50 uppercase tracking-wider">
                          {provider.name}
                        </p>
                      </div>

                      <div className="flex flex-col px-2 py-2 space-y-0.5">
                        {provider.chatModels.map((model) => (
                          <button
                            key={model.key}
                            onClick={() =>
                              handleModelSelect(provider.id, model.key)
                            }
                            type="button"
                            className={cn(
                              'px-3 py-2 flex items-center justify-between text-start duration-200 cursor-pointer transition rounded-lg group',
                              chatModelProvider?.providerId === provider.id &&
                                chatModelProvider?.key === model.key
                                ? 'bg-light-secondary dark:bg-dark-secondary'
                                : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                            )}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                              <Cpu
                                size={15}
                                className={cn(
                                  'shrink-0',
                                  chatModelProvider?.providerId ===
                                    provider.id &&
                                    chatModelProvider?.key === model.key
                                    ? 'text-sky-500'
                                    : 'text-black/50 dark:text-white/50 group-hover:text-black/70 group-hover:dark:text-white/70',
                                )}
                              />
                              <p
                                className={cn(
                                  'text-sm truncate',
                                  chatModelProvider?.providerId ===
                                    provider.id &&
                                    chatModelProvider?.key === model.key
                                    ? 'text-sky-500 font-medium'
                                    : 'text-black/70 dark:text-white/70 group-hover:text-black dark:group-hover:text-white',
                                )}
                              >
                                {model.name}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>

                      {providerIndex < filteredProviders.length - 1 && (
                        <div className="h-px bg-light-200 dark:bg-dark-200" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
};

export default ModelSelector;
