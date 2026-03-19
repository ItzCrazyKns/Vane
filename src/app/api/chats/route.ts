import db from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAuthEnabled } from '@/lib/auth';

export const GET = async (req: Request) => {
  try {
    const authEnabled = getAuthEnabled();
    const userId = req.headers.get('x-user-id');

    let chatsList;
    if (authEnabled) {
      if (!userId) {
        return Response.json({ chats: [] }, { status: 200 });
      }
      chatsList = await db.query.chats.findMany({
        where: eq(chats.userId, userId),
        orderBy: desc(chats.createdAt),
      });
    } else {
      chatsList = await db.query.chats.findMany({
        orderBy: desc(chats.createdAt),
      });
    }

    return Response.json({ chats: chatsList }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
