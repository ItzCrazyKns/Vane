import { getAuthEnabled, hasAnyUsers, createUser } from '@/lib/auth';

export const GET = async () => {
  const authEnabled = getAuthEnabled();
  if (!authEnabled) {
    return Response.json({ needsSetup: false });
  }

  const hasUsers = await hasAnyUsers();
  return Response.json({ needsSetup: !hasUsers });
};

export const POST = async (req: Request) => {
  try {
    const authEnabled = getAuthEnabled();
    if (!authEnabled) {
      return Response.json(
        { message: 'Authentication is not enabled.' },
        { status: 400 },
      );
    }

    const hasUsers = await hasAnyUsers();
    if (hasUsers) {
      return Response.json(
        { message: 'Setup already completed. An admin account already exists.' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return Response.json(
        { message: 'Username and password are required.' },
        { status: 400 },
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return Response.json(
        { message: 'Password must be at least 8 characters.' },
        { status: 400 },
      );
    }

    const user = await createUser(username, password, 'admin');
    return Response.json({ user }, { status: 201 });
  } catch (err) {
    console.error('Error during setup:', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
