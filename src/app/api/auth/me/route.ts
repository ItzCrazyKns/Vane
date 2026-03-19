import { getAuthEnabled, getUserById } from '@/lib/auth';

export const GET = async (req: Request) => {
  const authEnabled = getAuthEnabled();

  if (!authEnabled) {
    return Response.json({ user: null, authEnabled: false }, { status: 200 });
  }

  const userId = req.headers.get('x-user-id');

  if (!userId) {
    return Response.json(
      { user: null, authEnabled: true },
      { status: 401 },
    );
  }

  try {
    const user = await getUserById(userId);

    if (!user) {
      return Response.json(
        { user: null, authEnabled: true },
        { status: 401 },
      );
    }

    return Response.json(
      {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        authEnabled: true,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Auth me error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
};
