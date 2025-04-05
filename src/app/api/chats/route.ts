import db from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { eq, sql} from 'drizzle-orm';

export const GET = async (req: Request) => {
  try {
    // get header from request
    const headers = await req.headers;
    const userSessionId = headers.get('user-session-id')?.toString() ?? '';
    const maxRecordLimit = parseInt(headers.get('max-record-limit') || '20', 10);

    if (userSessionId == '') {
      return Response.json({ chats: {} }, { status: 200 });
    }
    
    let chatsRes = await db.query.chats.findMany({
      where: eq(chats.userSessionId, userSessionId),
    });
    
    chatsRes = chatsRes.reverse();
    // Keep only the latest records in the database. Delete older records.
    if (chatsRes.length > maxRecordLimit) {
      const deleteChatsQuery = sql`DELETE FROM chats
        WHERE userSessionId = ${userSessionId} AND (
          timestamp IS NULL OR
          timestamp NOT in (
            SELECT timestamp FROM chats
            WHERE userSessionId = ${userSessionId}
            ORDER BY timestamp DESC
            LIMIT ${maxRecordLimit}
          )
        )
      `;
      await db.run(deleteChatsQuery);
      // Delete messages that no longer link with the chat from the database.
      const deleteMessagesQuery = sql`DELETE FROM messages
        WHERE chatId NOT IN (
          SELECT id FROM chats
        )
      `;
      await db.run(deleteMessagesQuery);
    }

    return Response.json({ chats: chatsRes }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
