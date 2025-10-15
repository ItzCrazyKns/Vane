import ModelRegistry from '@/lib/models/registry';

export const GET = async (req: Request) => {
  try {
    const registry = new ModelRegistry();

    const activeProviders = await registry.getActiveProviders();

    return Response.json(
      {
        providers: activeProviders,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while fetching providers', err);
    return Response.json(
      {
        message: 'An error has occurred.',
      },
      {
        status: 500,
      },
    );
  }
};
