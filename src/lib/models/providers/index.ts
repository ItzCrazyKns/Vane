import { ModelProviderUISection } from '@/lib/config/types';
import { ProviderConstructor } from './baseProvider';
import OpenAIProvider from './openai';

export const providers: Record<string, ProviderConstructor<any>> = {
  openai: OpenAIProvider,
};

export const getModelProvidersUIConfigSection =
  (): ModelProviderUISection[] => {
    return Object.entries(providers).map(([k, p]) => {
      const configFields = p.getProviderConfigFields();
      const metadata = p.getProviderMetadata();

      return {
        fields: configFields,
        key: k,
        name: metadata.name,
      };
    });
  };
