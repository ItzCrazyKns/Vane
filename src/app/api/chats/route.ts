import db from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { eq, isNull, or } from 'drizzle-orm';

export const GET = async (req: Request) => {
  try {
    const userId = req.headers.get('x-user-id');

    // Require authentication - userId must be present
    if (!userId) {
      return Response.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Filter chats by user (also include chats without userId for legacy migration)
    let userChats = await db.query.chats.findMany({
      where: or(eq(chats.userId, userId), isNull(chats.userId)),
    });
    userChats = userChats.reverse();
    return Response.json({ chats: userChats }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
