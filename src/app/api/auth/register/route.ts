import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { users, auth } from '@/lib/db/schema';
import { hashPassword, createToken, setAuthCookie } from '@/lib/auth';
import { eq, sql } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    // Check if user exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existing) {
      return NextResponse.json(
        { message: 'User already exists' },
        { status: 409 },
      );
    }

    // Determine role - first user becomes admin
    const userCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .get();
    const isFirstUser = !userCount || userCount.count === 0;

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    const role = isFirstUser ? 'admin' : 'user';

    // Insert user
    db.insert(users)
      .values({
        id: userId,
        email: email.toLowerCase(),
        name: name || null,
        role,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Insert auth record
    db.insert(auth)
      .values({
        userId,
        email: email.toLowerCase(),
        passwordHash,
        active: true,
      })
      .run();

    // Create token and set cookie
    const token = await createToken(userId, email.toLowerCase(), role);
    await setAuthCookie(token);

    return NextResponse.json(
      {
        user: {
          id: userId,
          email: email.toLowerCase(),
          name: name || null,
          role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { message: 'An error occurred during registration' },
      { status: 500 },
    );
  }
}
