import { ModelProviderUISection, UIConfigField } from '../config/types';
import { ProviderMetadata } from './types';
import BaseModelProvider from './providers/baseProvider';
import OpenAIProvider from './providers/openai';

interface ProviderClass<T> {
  new (config: T): BaseModelProvider<T>;
  getProviderConfigFields(): UIConfigField[];
  getProviderMetadata(): ProviderMetadata;
}

const providers: Record<string, ProviderClass<any>> = {
  openai: OpenAIProvider,
};

class ModelRegistry {
  constructor() {}

  getUIConfigSection(): ModelProviderUISection[] {
    return Object.entries(providers).map(([k, p]) => {
      const configFields = p.getProviderConfigFields();
      const metadata = p.getProviderMetadata();

      return {
        fields: configFields,
        key: k,
        name: metadata.name,
      };
    });
  }
}

export default ModelRegistry;
