import { Dialog, Transition } from '@headlessui/react';
import { CloudUpload, RefreshCcw, RefreshCw } from 'lucide-react';
import React, { Fragment, useEffect, useState } from 'react';

interface SettingsType {
  providers: {
    [key: string]: string[];
  };
  openeaiApiKey: string;
  groqApiKey: string;
  ollamaApiUrl: string;
}

const SettingsDialog = ({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) => {
  const [config, setConfig] = useState<SettingsType | null>(null);
  const [selectedChatModelProvider, setSelectedChatModelProvider] = useState<
    string | null
  >(null);
  const [selectedChatModel, setSelectedChatModel] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchConfig = async () => {
        setIsLoading(true);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/config`);
        const data = await res.json();
        setConfig(data);
        setIsLoading(false);
      };

      fetchConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    setSelectedChatModelProvider(localStorage.getItem('chatModelProvider'));
    setSelectedChatModel(localStorage.getItem('chatModel'));
  }, []);

  const handleSubmit = async () => {
    setIsUpdating(true);

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      localStorage.setItem('chatModelProvider', selectedChatModelProvider!);
      localStorage.setItem('chatModel', selectedChatModel!);
    } catch (err) {
      console.log(err);
    } finally {
      setIsUpdating(false);
      setIsOpen(false);

      window.location.reload();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => setIsOpen(false)}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 scale-200"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform rounded-2xl bg-[#111111] border border-[#1c1c1c] p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title className="text-xl font-medium leading-6 text-white">
                  Settings
                </Dialog.Title>
                {config && !isLoading && (
                  <div className="flex flex-col space-y-4 mt-6">
                    {config.providers && (
                      <div className="flex flex-col space-y-1">
                        <p className="text-white/70 text-sm">
                          Chat model Provider
                        </p>
                        <select
                          onChange={(e) => {
                            setSelectedChatModelProvider(e.target.value);
                            setSelectedChatModel(
                              config.providers[e.target.value][0],
                            );
                          }}
                          className="bg-[#111111] px-3 py-2 flex items-center overflow-hidden border border-[#1C1C1C] text-white rounded-lg text-sm"
                        >
                          {Object.keys(config.providers).map((provider) => (
                            <option
                              key={provider}
                              value={provider}
                              selected={provider === selectedChatModelProvider}
                            >
                              {provider.charAt(0).toUpperCase() +
                                provider.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {selectedChatModelProvider && (
                      <div className="flex flex-col space-y-1">
                        <p className="text-white/70 text-sm">Chat Model</p>
                        <select
                          onChange={(e) => setSelectedChatModel(e.target.value)}
                          className="bg-[#111111] px-3 py-2 flex items-center overflow-hidden border border-[#1C1C1C] text-white rounded-lg text-sm"
                        >
                          {config.providers[selectedChatModelProvider] ? (
                            config.providers[selectedChatModelProvider].length >
                            0 ? (
                              config.providers[selectedChatModelProvider].map(
                                (model) => (
                                  <option
                                    key={model}
                                    value={model}
                                    selected={model === selectedChatModel}
                                  >
                                    {model}
                                  </option>
                                ),
                              )
                            ) : (
                              <option value="" disabled selected>
                                No models available
                              </option>
                            )
                          ) : (
                            <option value="" disabled selected>
                              Invalid provider, please check backend logs
                            </option>
                          )}
                        </select>
                      </div>
                    )}
                    <div className="flex flex-col space-y-1">
                      <p className="text-white/70 text-sm">OpenAI API Key</p>
                      <input
                        type="text"
                        placeholder="OpenAI API Key"
                        defaultValue={config.openeaiApiKey}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            openeaiApiKey: e.target.value,
                          })
                        }
                        className="bg-[#111111] px-3 py-2 flex items-center overflow-hidden border border-[#1C1C1C] text-white rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <p className="text-white/70 text-sm">Ollama API URL</p>
                      <input
                        type="text"
                        placeholder="Ollama API URL"
                        defaultValue={config.ollamaApiUrl}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            ollamaApiUrl: e.target.value,
                          })
                        }
                        className="bg-[#111111] px-3 py-2 flex items-center overflow-hidden border border-[#1C1C1C] text-white rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <p className="text-white/70 text-sm">GROQ API Key</p>
                      <input
                        type="text"
                        placeholder="GROQ API Key"
                        defaultValue={config.groqApiKey}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            groqApiKey: e.target.value,
                          })
                        }
                        className="bg-[#111111] px-3 py-2 flex items-center overflow-hidden border border-[#1C1C1C] text-white rounded-lg text-sm"
                      />
                    </div>
                  </div>
                )}
                {isLoading && (
                  <div className="w-full flex items-center justify-center mt-6 text-white/70 py-6">
                    <RefreshCcw className="animate-spin" />
                  </div>
                )}
                <div className="w-full mt-6 space-y-2">
                  <p className="text-xs text-white/50">
                    We&apos;ll refresh the page after updating the settings.
                  </p>
                  <button
                    onClick={handleSubmit}
                    className="bg-[#24A0ED] flex flex-row items-center space-x-2 text-white disabled:text-white/50 hover:bg-opacity-85 transition duration-100 disabled:bg-[#ececec21] rounded-full px-4 py-2"
                    disabled={isLoading || isUpdating}
                  >
                    {isUpdating ? (
                      <RefreshCw size={20} className="animate-spin" />
                    ) : (
                      <CloudUpload size={20} />
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default SettingsDialog;
