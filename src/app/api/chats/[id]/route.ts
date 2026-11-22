import db from '@/lib/db';
import { chatRecoveries, chats, messages } from '@/lib/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

const recoveryAckSchema = z.object({
  recoveryIds: z.array(z.string().min(1)).min(1),
});

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const includeRecoveries =
      new URL(req.url).searchParams.get('recover') === '1';

    const snapshot = db.transaction((tx) => {
      const chat = tx.query.chats.findFirst({ where: eq(chats.id, id) }).sync();
      const recoveries = includeRecoveries
        ? tx.query.chatRecoveries
            .findMany({
              where: eq(chatRecoveries.chatId, id),
              orderBy: asc(chatRecoveries.id),
            })
            .sync()
        : [];
      if (!chat && !recoveries.length) return null;

      const chatMessages = chat
        ? tx.query.messages
            .findMany({
              where: eq(messages.chatId, id),
              orderBy: asc(messages.id),
            })
            .sync()
        : [];

      return {
        chat: chat ?? null,
        messages: chatMessages,
        ...(includeRecoveries && { recoveries }),
      };
    });

    if (!snapshot) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    return Response.json(snapshot);
  } catch (err) {
    console.error('Error in getting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const PATCH = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const parsed = recoveryAckSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid recovery IDs' },
        { status: 400 },
      );
    }

    db.delete(chatRecoveries)
      .where(
        and(
          eq(chatRecoveries.chatId, id),
          inArray(chatRecoveries.backendId, parsed.data.recoveryIds),
        ),
      )
      .run();

    return Response.json({ acknowledged: true });
  } catch (err) {
    console.error('Error acknowledging chat recovery:', err);
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

    const removed = db.transaction((tx) => {
      const removedChat = tx.delete(chats).where(eq(chats.id, id)).run();
      const removedRecoveries = tx
        .delete(chatRecoveries)
        .where(eq(chatRecoveries.chatId, id))
        .run();
      if (!removedChat.changes && !removedRecoveries.changes) return false;

      tx.delete(messages).where(eq(messages.chatId, id)).run();
      return true;
    });

    if (!removed) {
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
