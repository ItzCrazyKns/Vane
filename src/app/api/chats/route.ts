import db from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { eq, isNull, or } from 'drizzle-orm';

export const GET = async (req: Request) => {
  try {
    const userId = req.headers.get('x-user-id');

    // Filter chats by user (also include chats without userId for migration)
    let userChats = await db.query.chats.findMany({
      where: userId ? or(eq(chats.userId, userId), isNull(chats.userId)) : undefined,
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
