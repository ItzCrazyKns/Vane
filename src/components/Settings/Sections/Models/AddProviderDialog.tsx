import {
  Description,
  Dialog,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { Loader2, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ConfigModelProvider,
  ModelProviderUISection,
  StringUIConfigField,
  UIConfigField,
} from '@/lib/config/types';
import Select from '@/components/ui/Select';
import { toast } from 'sonner';

const AddProvider = ({
  modelProviders,
  setProviders,
}: {
  modelProviders: ModelProviderUISection[];
  setProviders: React.Dispatch<React.SetStateAction<ConfigModelProvider[]>>;
}) => {
  const [open, setOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<null | string>(
    modelProviders[0]?.key || null,
  );
  const [config, setConfig] = useState<Record<string, any>>({});
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const providerConfigMap = useMemo(() => {
    const map: Record<string, { name: string; fields: UIConfigField[] }> = {};

    modelProviders.forEach((p) => {
      map[p.key] = {
        name: p.name,
        fields: p.fields,
      };
    });

    return map;
  }, [modelProviders]);

  const selectedProviderFields = useMemo(() => {
    if (!selectedProvider) return [];
    const providerFields = providerConfigMap[selectedProvider]?.fields || [];
    const config: Record<string, any> = {};

    providerFields.forEach((field) => {
      config[field.key] = field.default || '';
    });

    setConfig(config);

    return providerFields;
  }, [selectedProvider, providerConfigMap]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: selectedProvider,
          name: name,
          config: config,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to add provider');
      }

      const data: ConfigModelProvider = (await res.json()).provider;

      setProviders((prev) => [...prev, data]);

      toast.success('Provider added successfully.');
    } catch (error) {
      console.error('Error adding provider:', error);
      toast.error('Failed to add provider.');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs sm:text-sm border border-light-200 dark:border-dark-200 text-black dark:text-white bg-light-secondary/50 dark:bg-dark-secondary/50 hover:bg-light-secondary hover:dark:bg-dark-secondary hover:border-light-300 hover:dark:border-dark-300 flex flex-row items-center space-x-1 active:scale-95 transition duration-200"
      >
        <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
        <span>Add Provider</span>
      </button>
      <AnimatePresence>
        {open && (
          <Dialog
            static
            open={open}
            onClose={() => setOpen(false)}
            className="relative z-[60]"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="fixed inset-0 flex w-screen items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
            >
              <DialogPanel className="w-full mx-4 lg:w-[600px] max-h-[85vh] flex flex-col border bg-light-primary dark:bg-dark-primary border-light-secondary dark:border-dark-secondary rounded-lg">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1">
                  <div className="px-6 pt-6 pb-4">
                    <h3 className="text-black/90 dark:text-white/90 font-medium">
                      Add new provider
                    </h3>
                  </div>
                  <div className="border-t border-light-200 dark:border-dark-200" />
                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="flex flex-col space-y-4">
                      <div className="flex flex-col items-start space-y-2">
                        <label className="text-xs text-black/70 dark:text-white/70">
                          Select provider type
                        </label>
                        <Select
                          value={selectedProvider ?? ''}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                          options={Object.entries(providerConfigMap).map(
                            ([key, val]) => {
                              return {
                                label: val.name,
                                value: key,
                              };
                            },
                          )}
                        />
                      </div>

                      <div
                        key="name"
                        className="flex flex-col items-start space-y-2"
                      >
                        <label className="text-xs text-black/70 dark:text-white/70">
                          Name*
                        </label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-4 py-3 pr-10 text-sm text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:border-light-300 dark:focus-visible:border-dark-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder={'Provider Name'}
                          type="text"
                          required={true}
                        />
                      </div>

                      {selectedProviderFields.map((field: UIConfigField) => (
                        <div
                          key={field.key}
                          className="flex flex-col items-start space-y-2"
                        >
                          <label className="text-xs text-black/70 dark:text-white/70">
                            {field.name}
                            {field.required && '*'}
                          </label>
                          <input
                            value={config[field.key] ?? field.default ?? ''}
                            onChange={(event) =>
                              setConfig((prev) => ({
                                ...prev,
                                [field.key]: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-4 py-3 pr-10 text-sm text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:border-light-300 dark:focus-visible:border-dark-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder={
                              (field as StringUIConfigField).placeholder
                            }
                            type="text"
                            required={field.required}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-light-200 dark:border-dark-200" />
                  <div className="px-6 py-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 rounded-lg text-sm bg-sky-500 text-white font-medium disabled:opacity-85 hover:opacity-85 active:scale-95 transition duration-200"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        'Add Provider'
                      )}
                    </button>
                  </div>
                </form>
              </DialogPanel>
            </motion.div>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
};

export default AddProvider;
