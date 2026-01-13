'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/hooks/useAuth';

/**
 * Syncs user settings from database with client-side theme
 */
export default function UserSettingsSync() {
  const { user, loading } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (loading || !user) return;

    // Fetch and apply user settings
    const loadUserSettings = async () => {
      try {
        const res = await fetch('/api/users/settings');
        if (res.ok) {
          const data = await res.json();
          const settings = data.settings;

          // Sync user settings from database to localStorage
          // (clientRegistry functions read from localStorage)
          const settingsToSync = [
            'theme',
            'measureUnit',
            'autoMediaSearch',
            'showWeatherWidget',
            'showNewsWidget',
            'systemInstructions',
          ];

          settingsToSync.forEach((key) => {
            if (settings[key] !== undefined && settings[key] !== null) {
              localStorage.setItem(key, String(settings[key]));
            } else {
              // Remove if not set in database (use defaults)
              localStorage.removeItem(key);
            }
          });

          // Apply theme via next-themes (handles system preference etc.)
          if (settings.theme) {
            setTheme(settings.theme);
          }

          // Notify components that settings changed
          window.dispatchEvent(new Event('client-config-changed'));

          console.log('[UserSettingsSync] Applied user settings:', settings);
        }
      } catch (error) {
        console.error('[UserSettingsSync] Failed to load settings:', error);
      }
    };

    loadUserSettings();
  }, [user, loading, setTheme]);

  return null; // This component only syncs settings, no UI
}
