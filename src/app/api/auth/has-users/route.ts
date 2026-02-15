import db from '@/lib/db';
import { users } from '@/lib/db/schema';
import { count } from 'drizzle-orm';

export const GET = async () => {
  try {
    const result = await db
      .select({ count: count() })
      .from(users)
      .execute();

    const hasUsers = (result[0]?.count ?? 0) > 0;

    return Response.json({ hasUsers }, { status: 200 });
  } catch (err) {
    console.error('Error checking user count:', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
