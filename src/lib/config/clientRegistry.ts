'use client';

const getClientConfig = (key: string, defaultVal?: any) => {
  return localStorage.getItem(key) ?? defaultVal ?? undefined;
};

export const getTheme = () => getClientConfig('theme', 'dark');

export const getAutoImageSearch = () =>
  Boolean(getClientConfig('autoImageSearch', 'true'));

export const getAutoVideoSearch = () =>
  Boolean(getClientConfig('autoVideoSearch', 'true'));

export const getSystemInstructions = () =>
  getClientConfig('systemInstructions', '');
