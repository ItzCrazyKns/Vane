import { NextRequest, NextResponse } from 'next/server';
import db, { sqlite } from '@/lib/db';
import { users, auth } from '@/lib/db/schema';
import { hashPassword, createToken, setAuthCookie } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/auth/rateLimiter';
import { validatePassword, validateEmail } from '@/lib/auth/validation';
import { handleAuthRouteError } from '@/lib/auth/helpers';
import { logRegistration } from '@/lib/auth/audit';
import { eq, sql } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const rateLimit = checkRateLimit(`register:${clientIp}`);

    if (rateLimit.limited) {
      return NextResponse.json(
        {
          message: `Too many registration attempts. Try again in ${rateLimit.retryAfter} seconds.`,
        },
        { status: 429 },
      );
    }

    const { email, password, name } = await req.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 },
      );
    }

    // Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json(
        { message: 'Invalid email format' },
        { status: 400 },
      );
    }

    // Validate password complexity
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          message: 'Password does not meet requirements',
          errors: passwordValidation.errors,
        },
        { status: 400 },
      );
    }

    // Hash password before transaction (async operation)
    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const normalizedEmail = email.toLowerCase();

    // Use transaction to prevent race condition when determining first admin
    // better-sqlite3's transaction() ensures serialized write access
    let role: 'admin' | 'user';
    let userExistsError = false;

    const registerTransaction = sqlite.transaction(() => {
      // Check if user exists (inside transaction for safety)
      const existing = db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .get();

      if (existing) {
        userExistsError = true;
        return;
      }

      // Determine role - first user becomes admin
      const userCount = db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .get();
      const isFirstUser = !userCount || userCount.count === 0;
      role = isFirstUser ? 'admin' : 'user';

      // Insert user
      db.insert(users)
        .values({
          id: userId,
          email: normalizedEmail,
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
          email: normalizedEmail,
          passwordHash,
          active: true,
        })
        .run();
    });

    registerTransaction();

    if (userExistsError) {
      return NextResponse.json(
        { message: 'User already exists' },
        { status: 409 },
      );
    }

    // Create token and set cookie
    const token = await createToken(userId, normalizedEmail, role!);
    await setAuthCookie(token);

    // Log registration
    logRegistration(userId, normalizedEmail, role!, req.headers);

    return NextResponse.json(
      {
        user: {
          id: userId,
          email: normalizedEmail,
          name: name || null,
          role: role!,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleAuthRouteError(error, 'Registration');
  }
}
