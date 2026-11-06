/**
 * Favicons are served by Vane's own `/api/favicon` route instead of loading
 * them from Google (or Clearbit) in the browser, which told those services
 * every page the user researched.
 */
export const faviconSrc = (urlOrDomain?: string | null): string => {
  if (!urlOrDomain) return '';

  let hostname = urlOrDomain;
  try {
    hostname = new URL(
      urlOrDomain.includes('://') ? urlOrDomain : `https://${urlOrDomain}`,
    ).hostname;
  } catch {
    return '';
  }

  return hostname ? `/api/favicon?domain=${encodeURIComponent(hostname)}` : '';
};

/** onError handler that hides an <img> whose favicon could not be loaded. */
export const hideBrokenImage = (e: { currentTarget: HTMLImageElement }) => {
  e.currentTarget.style.visibility = 'hidden';
};
