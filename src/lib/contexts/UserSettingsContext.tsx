'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/hooks/useAuth';

export interface UserSettings {
  theme?: 'light' | 'dark';
  measureUnit?: 'Imperial' | 'Metric';
  autoMediaSearch?: boolean;
  showWeatherWidget?: boolean;
  showNewsWidget?: boolean;
  systemInstructions?: string;
}

interface UserSettingsContextType {
  settings: UserSettings;
  loading: boolean;
  synced: boolean;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  getSetting: <K extends keyof UserSettings>(
    key: K,
    defaultValue?: UserSettings[K],
  ) => UserSettings[K] | undefined;
}

const UserSettingsContext = createContext<UserSettingsContextType | null>(null);

const SETTINGS_KEYS: (keyof UserSettings)[] = [
  'theme',
  'measureUnit',
  'autoMediaSearch',
  'showWeatherWidget',
  'showNewsWidget',
  'systemInstructions',
];

export function UserSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings>({});
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);

  // Load settings from database when user is authenticated
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Not logged in - load from localStorage only
      const localSettings: UserSettings = {};
      SETTINGS_KEYS.forEach((key) => {
        const value = localStorage.getItem(key);
        if (value !== null) {
          if (key === 'autoMediaSearch' || key === 'showWeatherWidget' || key === 'showNewsWidget') {
            (localSettings as any)[key] = value === 'true';
          } else {
            (localSettings as any)[key] = value;
          }
        }
      });
      setSettings(localSettings);
      setLoading(false);
      setSynced(true);
      return;
    }

    // Fetch settings from database
    const loadUserSettings = async () => {
      try {
        const res = await fetch('/api/users/settings');
        if (res.ok) {
          const data = await res.json();
          const dbSettings = data.settings || {};

          // Sync to localStorage for components that read directly
          SETTINGS_KEYS.forEach((key) => {
            if (dbSettings[key] !== undefined && dbSettings[key] !== null) {
              localStorage.setItem(key, String(dbSettings[key]));
            } else {
              localStorage.removeItem(key);
            }
          });

          // Apply theme via next-themes
          if (dbSettings.theme) {
            setTheme(dbSettings.theme);
          }

          setSettings(dbSettings);

          // Notify legacy components that settings changed
          window.dispatchEvent(new Event('client-config-changed'));
        }
      } catch (error) {
        console.error('[UserSettings] Failed to load settings:', error);
      } finally {
        setLoading(false);
        setSynced(true);
      }
    };

    loadUserSettings();
  }, [user, authLoading, setTheme]);

  // Update settings in database and locally
  const updateSettings = useCallback(
    async (newSettings: Partial<UserSettings>) => {
      // Optimistic update
      setSettings((prev) => ({ ...prev, ...newSettings }));

      // Update localStorage
      Object.entries(newSettings).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          localStorage.setItem(key, String(value));
        } else {
          localStorage.removeItem(key);
        }
      });

      // Apply theme immediately if changed
      if (newSettings.theme) {
        setTheme(newSettings.theme);
      }

      // Persist to database if logged in
      if (user) {
        try {
          await fetch('/api/users/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: newSettings }),
          });
        } catch (error) {
          console.error('[UserSettings] Failed to save settings:', error);
        }
      }

      // Notify legacy components
      window.dispatchEvent(new Event('client-config-changed'));
    },
    [user, setTheme],
  );

  // Get a setting with optional default value
  const getSetting = useCallback(
    <K extends keyof UserSettings>(
      key: K,
      defaultValue?: UserSettings[K],
    ): UserSettings[K] | undefined => {
      return settings[key] ?? defaultValue;
    },
    [settings],
  );

  return (
    <UserSettingsContext.Provider
      value={{ settings, loading, synced, updateSettings, getSetting }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error('useUserSettings must be used within UserSettingsProvider');
  }
  return context;
}
