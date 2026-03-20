import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthEnabled, isAdmin } from '@/lib/auth';

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

    // Ownership check when auth is enabled (admins can view any chat)
    const authEnabled = getAuthEnabled();
    const userId = req.headers.get('x-user-id');
    if (authEnabled && chatExists.userId !== userId) {
      const admin = userId ? await isAdmin(userId) : false;
      if (!admin) {
        return Response.json({ message: 'Chat not found' }, { status: 404 });
      }
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

    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    // Ownership check when auth is enabled (admins can delete any chat)
    const authEnabled = getAuthEnabled();
    const userId = req.headers.get('x-user-id');
    if (authEnabled && chatExists.userId !== userId) {
      const admin = userId ? await isAdmin(userId) : false;
      if (!admin) {
        return Response.json({ message: 'Chat not found' }, { status: 404 });
      }
    }

    // Delete atomically — messages first (FK will cascade, but explicit is safer)
    db.transaction((tx) => {
      tx.delete(messages).where(eq(messages.chatId, id)).run();
      tx.delete(chats).where(eq(chats.id, id)).run();
    });

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
