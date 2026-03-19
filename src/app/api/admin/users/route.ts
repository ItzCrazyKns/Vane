import { requireAdmin, getAllUsers, createUser } from '@/lib/auth';

export const GET = async (req: Request) => {
  const result = await requireAdmin(req);
  if ('error' in result) return result.error;

  const users = await getAllUsers();
  return Response.json({ users });
};

export const POST = async (req: Request) => {
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

  if (role !== 'admin' && role !== 'user') {
    return Response.json(
      { message: 'Role must be admin or user.' },
      { status: 400 },
    );
  }

  try {
    const user = await createUser(username, password, role);
    return Response.json({ user }, { status: 201 });
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE constraint')) {
      return Response.json(
        { message: 'Username already exists' },
        { status: 409 },
      );
    }
    throw err;
  }
};
