import { providers } from '../models/providers';
import { Config, ConfigModelProvider, UIConfigSections } from './types';

/**
 * Placeholder sent to the browser instead of a stored secret. When the
 * settings UI sends it back unchanged, the stored value is kept.
 */
export const SECRET_MASK = '••••••••';

export const isMaskedSecret = (value: unknown) => value === SECRET_MASK;

const maskValue = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? SECRET_MASK : value;

/** Keys of the `password` fields a provider type declares. */
export const getProviderSecretKeys = (type: string): string[] => {
  const provider = providers[type];
  if (!provider) return [];

  return provider
    .getProviderConfigFields()
    .filter((f) => f.type === 'password')
    .map((f) => f.key);
};

export const maskProvider = <
  T extends Pick<ConfigModelProvider, 'type' | 'config'>,
>(
  provider: T,
): T => {
  const config = { ...provider.config };

  getProviderSecretKeys(provider.type).forEach((k) => {
    config[k] = maskValue(config[k]);
  });

  return { ...provider, config };
};

/**
 * Returns a copy of the config that is safe to send to the browser: provider
 * API keys and every `password` field of the UI sections are replaced by
 * SECRET_MASK.
 */
export const maskConfig = (
  config: Config,
  sections: UIConfigSections,
): Config => {
  const masked: Config = JSON.parse(JSON.stringify(config));

  masked.modelProviders = masked.modelProviders.map((p) => maskProvider(p));

  (Object.keys(sections) as (keyof UIConfigSections)[]).forEach((section) => {
    if (section === 'modelProviders') return;

    const values = (masked as any)[section];
    if (!values || typeof values !== 'object') return;

    (sections[section] as any[]).forEach((field) => {
      if (field.type === 'password' && field.key in values) {
        values[field.key] = maskValue(values[field.key]);
      }
    });
  });

  return masked;
};

/**
 * Merges a provider config sent by the browser with the stored one, keeping
 * every secret the browser sent back as SECRET_MASK.
 */
export const restoreMaskedProviderSecrets = (
  type: string,
  incoming: Record<string, any>,
  stored: Record<string, any>,
): Record<string, any> => {
  const result = { ...incoming };

  getProviderSecretKeys(type).forEach((k) => {
    if (isMaskedSecret(result[k])) {
      result[k] = stored[k];
    }
  });

  return result;
};
