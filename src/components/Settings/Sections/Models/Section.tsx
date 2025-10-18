import React, { useState } from 'react';
import AddProvider from './AddProviderDialog';
import {
  ConfigModelProvider,
  ModelProviderUISection,
  UIConfigField,
} from '@/lib/config/types';
import ModelProvider from './ModelProvider';

const Models = ({
  fields,
  values,
}: {
  fields: ModelProviderUISection[];
  values: ConfigModelProvider[];
}) => {
  const [providers, setProviders] = useState<ConfigModelProvider[]>(values);

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
      <div className="flex flex-row justify-between items-center">
        <p className="text-sm text-black/70 dark:text-white/70">
          Manage model provider
        </p>
        <AddProvider modelProviders={fields} setProviders={setProviders} />
      </div>
      <div className="flex flex-col gap-y-4">
        {providers.map((provider) => (
          <ModelProvider
            key={`provider-${provider.id}`}
            fields={
              (fields.find((f) => f.key === provider.type)?.fields ??
                []) as UIConfigField[]
            }
            modelProvider={provider}
            setProviders={setProviders}
          />
        ))}
      </div>
    </div>
  );
};

export default Models;
