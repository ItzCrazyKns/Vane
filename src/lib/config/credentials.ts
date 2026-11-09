/**
 * Config field names whose values are credentials. `key` alone is not enough:
 * a `Model` identifies itself with `key`, so matching every property called
 * `key` would mask the model IDs the UI needs to offer them.
 */
const CREDENTIAL_KEY = /api[_-]?key|secret|token|password|credential/i;

export function isCredentialKey(key: string): boolean {
  return CREDENTIAL_KEY.test(key);
}

/** Mask every credential-named string in the response. An unauthenticated
 *  caller could read each provider's config.apiKey verbatim; the value is
 *  dropped here instead of being spread through, and the walk is recursive so
 *  a key nested under preferences or search is masked too. Non-string values
 *  and an empty string are left as they are: an empty value is not a secret. */
export function redactCredentials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactCredentials);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        typeof entry === 'string' && entry !== '' && isCredentialKey(key)
          ? ''
          : redactCredentials(entry),
      ]),
    );
  }
  return value;
}

/**
 * Apply an incoming provider config over the stored one. A credential that
 * arrives blank or omitted keeps its stored value: `redactCredentials` blanks
 * it in GET /api/config, so a client editing an unrelated field would
 * otherwise send the mask back and erase the saved key.
 */
export function mergeProviderConfig(
  stored: Record<string, any>,
  incoming: Record<string, any>,
): Record<string, any> {
  const merged: Record<string, any> = { ...incoming };

  for (const [key, value] of Object.entries(merged)) {
    if (
      value === '' &&
      isCredentialKey(key) &&
      typeof stored[key] === 'string' &&
      stored[key] !== ''
    ) {
      merged[key] = stored[key];
    }
  }

  for (const [key, value] of Object.entries(stored)) {
    if (
      !(key in merged) &&
      isCredentialKey(key) &&
      typeof value === 'string' &&
      value !== ''
    ) {
      merged[key] = value;
    }
  }

  return merged;
}
