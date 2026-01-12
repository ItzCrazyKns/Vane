import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { users, auth } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/admin/users - List all users (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const userRole = req.headers.get('x-user-role');

    if (userRole !== 'admin') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(users.createdAt);

    return NextResponse.json({ users: allUsers });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { message: 'An error occurred' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/users - Delete a user (admin only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const userRole = req.headers.get('x-user-role');
    const currentUserId = req.headers.get('x-user-id');

    if (userRole !== 'admin') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await req.json();

    // Prevent deleting yourself
    if (userId === currentUserId) {
      return NextResponse.json(
        { message: 'Cannot delete your own account' },
        { status: 400 },
      );
    }

    // Delete user (cascade will delete auth and chats)
    await db.delete(users).where(eq(users.id, userId)).execute();

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { message: 'An error occurred' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/users - Update user role (admin only)
 */
export async function PATCH(req: NextRequest) {
  try {
    const userRole = req.headers.get('x-user-role');
    const currentUserId = req.headers.get('x-user-id');

    if (userRole !== 'admin') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { userId, role } = await req.json();

    if (!['user', 'admin'].includes(role)) {
      return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
    }

    // Prevent demoting yourself if you're the last admin
    if (userId === currentUserId && role === 'user') {
      const adminCount = await db
        .select({ count: db.$count() })
        .from(users)
        .where(eq(users.role, 'admin'))
        .execute();

      if (adminCount[0]?.count <= 1) {
        return NextResponse.json(
          { message: 'Cannot demote the last admin' },
          { status: 400 },
        );
      }
    }

    await db
      .update(users)
      .set({ role, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId))
      .execute();

    return NextResponse.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { message: 'An error occurred' },
      { status: 500 },
    );
  }
}
