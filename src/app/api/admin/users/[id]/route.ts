import { requireAdmin, deleteUserById, resetPasswordById } from '@/lib/auth';

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const result = await requireAdmin(req);
    if ('error' in result) return result.error;

    const { id } = await params;
    const userId = req.headers.get('x-user-id');

    if (id === userId) {
      return Response.json(
        { message: 'Cannot delete your own account' },
        { status: 400 },
      );
    }

    deleteUserById(id);
    return Response.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Error deleting user:', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const PATCH = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const result = await requireAdmin(req);
    if ('error' in result) return result.error;

    const { id } = await params;
    const body = await req.json();

    if (!body.password) {
      return Response.json(
        { message: 'Password is required.' },
        { status: 400 },
      );
    }

    await resetPasswordById(id, body.password);
    return Response.json({ message: 'Password reset' });
  } catch (err) {
    console.error('Error resetting password:', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
