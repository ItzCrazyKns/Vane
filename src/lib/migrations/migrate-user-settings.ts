import db from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import configManager from '@/lib/config';

/**
 * Migrates user settings from global config to per-user database storage.
 * Run once per user on their first login after the settings refactor.
 */
export async function migrateUserSettings(userId: string): Promise<void> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    // Only migrate if settings is null, undefined, or empty object
    if (!user?.settings || Object.keys(user.settings).length === 0) {
      const config = configManager.getCurrentConfig();

      // Populate user settings with defaults from global config
      await db
        .update(users)
        .set({
          settings: {
            theme: config.preferences?.theme || 'light',
            measureUnit: config.preferences?.measureUnit || 'metric',
            autoMediaSearch: config.preferences?.autoMediaSearch || false,
            showWeatherWidget: config.preferences?.showWeatherWidget || true,
            showNewsWidget: config.preferences?.showNewsWidget || true,
            systemInstructions:
              config.personalization?.systemInstructions || '',
          },
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId));

      console.log(`Migrated settings for user ${userId}`);
    }
  } catch (err) {
    console.error(`Failed to migrate settings for user ${userId}:`, err);
    // Don't throw - migration failure shouldn't block login
  }
}
