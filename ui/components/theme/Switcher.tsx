'use client';
import { useTheme } from 'next-themes';
import { SunIcon, MoonIcon, MonitorIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type Theme = 'dark' | 'light' | 'system';

interface ThemeSwitcherProps {
  size?: number | string;
  className?: string;
}

const ThemeSwitcher = ({ size, className }: ThemeSwitcherProps) => {
  const [mounted, setMounted] = useState(false);

  const { theme, setTheme } = useTheme();

  const isTheme = useCallback((t: Theme) => t === theme, [theme]);

  const handleThemeSwitch = (theme: Theme) => {
    setTheme(theme);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return isTheme('dark') ? (
    <SunIcon
      className={cn('cursor-pointer', className)}
      size={size}
      onClick={() => handleThemeSwitch('light')}
    />
  ) : isTheme('light') ? (
    <MoonIcon
      className={cn('cursor-pointer', className)}
      size={size}
      onClick={() => handleThemeSwitch('dark')}
    />
  ) : (
    <MonitorIcon
      className={cn('cursor-pointer', className)}
      size={size}
      onClick={() => handleThemeSwitch('system')}
    />
  );
};

export default ThemeSwitcher;
