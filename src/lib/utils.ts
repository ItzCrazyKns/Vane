import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...classes: ClassValue[]) => twMerge(clsx(...classes));

export type TimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'year';

export const getTimeDifference = (
  date1: Date | string,
  date2: Date | string,
): { unit: TimeUnit; count: number } => {
  const diffInSeconds = Math.floor(
    Math.abs(new Date(date2).getTime() - new Date(date1).getTime()) / 1000,
  );

  if (diffInSeconds < 60) return { unit: 'second', count: diffInSeconds };
  if (diffInSeconds < 3600)
    return { unit: 'minute', count: Math.floor(diffInSeconds / 60) };
  if (diffInSeconds < 86400)
    return { unit: 'hour', count: Math.floor(diffInSeconds / 3600) };
  if (diffInSeconds < 31536000)
    return { unit: 'day', count: Math.floor(diffInSeconds / 86400) };
  return { unit: 'year', count: Math.floor(diffInSeconds / 31536000) };
};
