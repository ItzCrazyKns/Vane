import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { users, auth } from '@/lib/db/schema';
import { verifyPassword, createToken, setAuthCookie } from '@/lib/auth';
import {
  checkRateLimit,
  resetRateLimit,
  getClientIp,
} from '@/lib/auth/rateLimiter';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const rateLimit = checkRateLimit(`login:${clientIp}`);

    if (rateLimit.limited) {
      return NextResponse.json(
        {
          message: `Too many login attempts. Try again in ${rateLimit.retryAfter} seconds.`,
        },
        { status: 429 },
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 },
      );
    }

    // Find auth record
    const authRecord = await db.query.auth.findFirst({
      where: eq(auth.email, email.toLowerCase()),
    });

    if (!authRecord || !authRecord.active) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 },
      );
    }

    // Verify password
    const valid = await verifyPassword(password, authRecord.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 },
      );
    }

    // Get user profile
    const user = await db.query.users.findFirst({
      where: eq(users.id, authRecord.userId),
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Create token and set cookie
    const token = await createToken(
      user.id,
      user.email,
      user.role as 'user' | 'admin',
    );
    await setAuthCookie(token);

    // Clear rate limit on successful login
    resetRateLimit(`login:${clientIp}`);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'An error occurred during login' },
      { status: 500 },
    );
  }
}
