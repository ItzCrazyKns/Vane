'use client';
import { useTheme } from 'next-themes';
import { useCallback, useEffect } from 'react';
import Select from '../ui/Select';
import { useTranslations } from 'next-intl';
import { useIsClient } from '@/lib/hooks/useIsClient';

type Theme = 'dark' | 'light' | 'system';

const ThemeSwitcher = ({ className }: { className?: string }) => {
  const mounted = useIsClient();
  const t = useTranslations('Theme');

  const { theme, setTheme } = useTheme();

  const isTheme = useCallback((t: Theme) => t === theme, [theme]);

  const handleThemeSwitch = (theme: Theme) => {
    setTheme(theme);
  };

  useEffect(() => {
    if (isTheme('system')) {
      const preferDarkScheme = window.matchMedia(
        '(prefers-color-scheme: dark)',
      );

      const detectThemeChange = (event: MediaQueryListEvent) => {
        const theme: Theme = event.matches ? 'dark' : 'light';
        setTheme(theme);
      };

      preferDarkScheme.addEventListener('change', detectThemeChange);

      return () => {
        preferDarkScheme.removeEventListener('change', detectThemeChange);
      };
    }
  }, [isTheme, setTheme, theme]);

  // Avoid Hydration Mismatch
  if (!mounted) {
    return null;
  }

  return (
    <Select
      className={className}
      value={theme}
      onChange={(e) => handleThemeSwitch(e.target.value as Theme)}
      options={[
        { value: 'light', label: t('light') },
        { value: 'dark', label: t('dark') },
      ]}
    />
  );
};

export default ThemeSwitcher;
