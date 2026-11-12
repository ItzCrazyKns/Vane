/* RFC 9110 field-name: one or more "tchar" characters */
const HEADER_NAME_REGEX = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * Parses the optional "custom headers" provider setting.
 *
 * The value is a JSON object mapping header names to string values, e.g.
 * `{"x-opencode-session": "vane"}`. An already-parsed object is accepted as
 * well. Empty values yield `undefined` so callers can skip sending headers.
 */
export const parseCustomHeaders = (
  raw: unknown,
): Record<string, string> | undefined => {
  if (raw === undefined || raw === null) return undefined;

  let value: unknown = raw;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;

    try {
      value = JSON.parse(trimmed);
    } catch {
      throw new Error(
        'Invalid custom headers. Expected a JSON object, e.g. {"x-header": "value"}',
      );
    }
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(
      'Invalid custom headers. Expected a JSON object, e.g. {"x-header": "value"}',
    );
  }

  const headers: Record<string, string> = {};

  for (const [name, headerValue] of Object.entries(value)) {
    if (!HEADER_NAME_REGEX.test(name)) {
      throw new Error(`Invalid custom header name: "${name}"`);
    }

    if (typeof headerValue !== 'string') {
      throw new Error(`Value of custom header "${name}" must be a string`);
    }

    if (/[\r\n\0]/.test(headerValue)) {
      throw new Error(
        `Value of custom header "${name}" contains invalid characters`,
      );
    }

    headers[name] = headerValue;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
};
