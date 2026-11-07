export const register = async () => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    /* `next build` loads this hook in every page-data worker at once. The
       migrations run when the server starts, not in the build, where the
       workers would race on the same fresh db.sqlite. */
    if (process.env.NEXT_PHASE === 'phase-production-build') return;

    try {
      console.log('Running database migrations...');
      const { runMigrations } = await import('./lib/db/migrate');
      runMigrations();
      console.log('Database migrations completed successfully');
    } catch (error) {
      console.error('Failed to run database migrations:', error);
      /* Without the tables every chat request fails with "no such table", so
         stop the server here instead of starting it half broken. */
      throw error;
    }

    await import('./lib/config/index');
  }
};
