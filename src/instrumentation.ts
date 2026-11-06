export const register = async () => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      console.log('Running database migrations...');
      const { runMigrations } = await import('./lib/db/migrate');
      runMigrations();
      console.log('Database migrations completed successfully');
    } catch (error) {
      console.error('Failed to run database migrations:', error);
      /* Without the tables every chat request fails with "no such table", so
         stop the server here instead of starting it half broken. `next build`
         can load this hook too; there it only logs. */
      if (process.env.NEXT_PHASE !== 'phase-production-build') {
        throw error;
      }
    }

    await import('./lib/config/index');
  }
};
