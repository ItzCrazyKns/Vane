/**
 * HTTP failure from a search provider. Carries the status (and Retry-After,
 * when sent) so searchWeb can tell a rate limit or a bot block, which is
 * worth retrying after a pause, from a hard error.
 */
export class SearchHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'SearchHttpError';
  }
}

/** Parses a Retry-After header (seconds or HTTP date) into milliseconds. */
export const parseRetryAfter = (
  value: string | null | undefined,
): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return undefined;
};
