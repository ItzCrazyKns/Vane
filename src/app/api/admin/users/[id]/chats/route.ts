import { requireAdmin } from '@/lib/auth';
import db from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const result = await requireAdmin(req);
  if ('error' in result) return result.error;

  const { id } = await params;

  const userChats = await db.query.chats.findMany({
    where: eq(chats.userId, id),
    orderBy: desc(chats.createdAt),
  });

  return Response.json({ chats: userChats });
};
