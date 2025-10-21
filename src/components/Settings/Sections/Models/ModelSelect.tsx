import Select from '@/components/ui/Select';
import { ConfigModelProvider } from '@/lib/config/types';
import { useState } from 'react';
import { toast } from 'sonner';

const ModelSelect = ({
  providers,
  type,
}: {
  providers: ConfigModelProvider[];
  type: 'chat' | 'embedding';
}) => {
  const [selectedModel, setSelectedModel] = useState<string>(
    type === 'chat'
      ? `${localStorage.getItem('chatModelProviderId')}/${localStorage.getItem('chatModelKey')}`
      : `${localStorage.getItem('embeddingModelProviderId')}/${localStorage.getItem('embeddingModelKey')}`,
  );
  const [loading, setLoading] = useState(false);

  const handleSave = async (newValue: string) => {
    setLoading(true);
    setSelectedModel(newValue);

    try {
      if (type === 'chat') {
        localStorage.setItem('chatModelProviderId', newValue.split('/')[0]);
        localStorage.setItem(
          'chatModelKey',
          newValue.split('/').slice(1).join('/'),
        );
      } else {
        localStorage.setItem(
          'embeddingModelProviderId',
          newValue.split('/')[0],
        );
        localStorage.setItem(
          'embeddingModelKey',
          newValue.split('/').slice(1).join('/'),
        );
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-base text-black dark:text-white">
            Select {type === 'chat' ? 'Chat Model' : 'Embedding Model'}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {type === 'chat'
              ? 'Select the model to use for chat responses'
              : 'Select the model to use for embeddings'}
          </p>
        </div>
        <Select
          value={selectedModel}
          onChange={(event) => handleSave(event.target.value)}
          options={
            type === 'chat'
              ? providers.flatMap((provider) =>
                  provider.chatModels.map((model) => ({
                    value: `${provider.id}/${model.key}`,
                    label: `${provider.name} - ${model.name}`,
                  })),
                )
              : providers.flatMap((provider) =>
                  provider.embeddingModels.map((model) => ({
                    value: `${provider.id}/${model.key}`,
                    label: `${provider.name} - ${model.name}`,
                  })),
                )
          }
          className="!text-xs lg:!text-sm"
          loading={loading}
          disabled={loading}
        />
      </div>
    </section>
  );
};

export default ModelSelect;
