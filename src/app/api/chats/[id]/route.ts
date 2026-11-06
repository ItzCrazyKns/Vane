import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    const chatMessages = await db.query.messages.findMany({
      where: eq(messages.chatId, id),
    });

    return Response.json(
      {
        chat: chatExists,
        messages: chatMessages,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in getting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    /* One transaction: either the chat and all its messages go, or nothing
     * does (no orphaned messages, no chat left without its history). */
    const deleted = db.transaction((tx) => {
      const chat = tx
        .select({ id: chats.id })
        .from(chats)
        .where(eq(chats.id, id))
        .get();
      if (!chat) return false;
      tx.delete(messages).where(eq(messages.chatId, id)).run();
      tx.delete(chats).where(eq(chats.id, id)).run();
      return true;
    });

    if (!deleted) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    return Response.json(
      { message: 'Chat deleted successfully' },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in deleting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
