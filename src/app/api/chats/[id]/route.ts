import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';

/**
 * Check if user owns the chat (or chat has no owner for migration).
 */
const userOwnsChat = (
  chat: { userId: string | null },
  userId: string | null,
): boolean => {
  // Allow access if chat has no owner (legacy data) or user owns it
  return chat.userId === null || chat.userId === userId;
};

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const userId = req.headers.get('x-user-id');

    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    // Verify ownership
    if (!userOwnsChat(chatExists, userId)) {
      return Response.json({ message: 'Forbidden' }, { status: 403 });
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
    const userId = req.headers.get('x-user-id');

    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    // Verify ownership
    if (!userOwnsChat(chatExists, userId)) {
      return Response.json({ message: 'Forbidden' }, { status: 403 });
    }

    await db.delete(chats).where(eq(chats.id, id)).execute();
    await db.delete(messages).where(eq(messages.chatId, id)).execute();

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
