import db from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthEnabled } from '@/lib/auth';

export const GET = async (req: Request) => {
  try {
    const authEnabled = getAuthEnabled();
    const userId = req.headers.get('x-user-id');

    let chatsList;
    if (authEnabled && userId) {
      chatsList = await db.query.chats.findMany({
        where: eq(chats.userId, userId),
      });
    } else {
      chatsList = await db.query.chats.findMany();
    }

    chatsList = chatsList.reverse();
    return Response.json({ chats: chatsList }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
