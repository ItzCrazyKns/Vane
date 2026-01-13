import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { users, auth } from '@/lib/db/schema';
import { eq, count } from 'drizzle-orm';
import { requireAdmin, isAuthError } from '@/lib/auth/helpers';
import { logUserDelete, logRoleChange } from '@/lib/auth/audit';

/**
 * GET /api/admin/users - List all users (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

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
    if (isAuthError(error)) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
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
    const admin = await requireAdmin();
    const { userId } = await req.json();

    // Prevent deleting yourself
    if (userId === admin.userId) {
      return NextResponse.json(
        { message: 'Cannot delete your own account' },
        { status: 400 },
      );
    }

    // Get user info before deletion for audit log
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!targetUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 },
      );
    }

    // Delete user (cascade will delete auth and chats)
    await db.delete(users).where(eq(users.id, userId)).execute();

    // Log the deletion
    logUserDelete(admin.userId, userId, targetUser.email, req.headers);

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
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
    const admin = await requireAdmin();
    const { userId, role } = await req.json();

    if (!['user', 'admin'].includes(role)) {
      return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
    }

    // Get current user to check old role
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!targetUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const oldRole = targetUser.role;

    // Prevent demoting yourself if you're the last admin
    if (userId === admin.userId && role === 'user') {
      const adminCount = await db
        .select({ count: count() })
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

    // Only update if role actually changed
    if (oldRole !== role) {
      await db
        .update(users)
        .set({ role, updatedAt: new Date().toISOString() })
        .where(eq(users.id, userId))
        .execute();

      // Log role change
      logRoleChange(admin.userId, userId, oldRole, role, req.headers);
    }

    return NextResponse.json({ message: 'User role updated successfully' });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    console.error('Error updating user:', error);
    return NextResponse.json(
      { message: 'An error occurred' },
      { status: 500 },
    );
  }
}
