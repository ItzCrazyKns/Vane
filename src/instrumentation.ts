export const register = async () => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      console.log('Running database migrations...');
      await import('./lib/db/migrate');
      console.log('Database migrations completed successfully');
    } catch (error) {
      console.error('Failed to run database migrations:', error);
    }

    await import('./lib/config/index');
  }
};
