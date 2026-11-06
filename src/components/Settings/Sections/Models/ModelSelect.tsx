import Select from '@/components/ui/Select';
import { ConfigModelProvider } from '@/lib/config/types';
import { useChat } from '@/lib/hooks/useChat';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('Models');
  const { setChatModelProvider, setEmbeddingModelProvider } = useChat();

  const handleSave = async (newValue: string) => {
    setLoading(true);
    setSelectedModel(newValue);

    try {
      if (type === 'chat') {
        const providerId = newValue.split('/')[0];
        const modelKey = newValue.split('/').slice(1).join('/');

        localStorage.setItem('chatModelProviderId', providerId);
        localStorage.setItem('chatModelKey', modelKey);

        setChatModelProvider({
          providerId: providerId,
          key: modelKey,
        });
      } else {
        const providerId = newValue.split('/')[0];
        const modelKey = newValue.split('/').slice(1).join('/');

        localStorage.setItem('embeddingModelProviderId', providerId);
        localStorage.setItem('embeddingModelKey', modelKey);

        setEmbeddingModelProvider({
          providerId: providerId,
          key: modelKey,
        });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error(t('saveConfigError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-sm text-black dark:text-white">
            {type === 'chat' ? t('selectChatModel') : t('selectEmbeddingModel')}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {type === 'chat'
              ? t('chatModelDescription')
              : t('embeddingModelDescription')}
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
          className="!text-xs lg:!text-[13px]"
          loading={loading}
          disabled={loading}
        />
      </div>
    </section>
  );
};

export default ModelSelect;
