import { requireAdmin, getAllUsers, createUser } from '@/lib/auth';

export const GET = async (req: Request) => {
  try {
    const result = await requireAdmin(req);
    if ('error' in result) return result.error;

    const users = await getAllUsers();
    return Response.json({ users });
  } catch (err) {
    console.error('Error fetching users:', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const POST = async (req: Request) => {
  try {
    const result = await requireAdmin(req);
    if ('error' in result) return result.error;

    const body = await req.json();
    const { username, password, role } = body;

    if (!username || !password || !role) {
      return Response.json(
        { message: 'Username, password, and role are required.' },
        { status: 400 },
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return Response.json(
        { message: 'Password must be at least 8 characters.' },
        { status: 400 },
      );
    }

    if (role !== 'admin' && role !== 'user') {
      return Response.json(
        { message: 'Role must be admin or user.' },
        { status: 400 },
      );
    }

    const user = await createUser(username, password, role);
    return Response.json({ user }, { status: 201 });
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE constraint')) {
      return Response.json(
        { message: 'Username already exists' },
        { status: 409 },
      );
    }
    console.error('Error creating user:', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
