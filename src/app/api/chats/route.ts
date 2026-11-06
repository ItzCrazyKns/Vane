import db from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { desc, getTableColumns, lt, sql } from 'drizzle-orm';

const MAX_LIMIT = 500;

/*
 * Newest first by insertion order (rowid), which is exactly the order the
 * old findMany().reverse() produced. createdAt is not used: chats saved by
 * older versions hold Date#toString() values, which do not sort as text.
 * rowid is the table's own B-tree key, so ordering and paging need no index.
 */
const rowid = sql<number>`${chats}.rowid`;

const parsePositiveInt = (value: string | null) =>
  value !== null && /^\d+$/.test(value) && Number(value) > 0
    ? Number(value)
    : null;

export const GET = async (req: Request) => {
  try {
    const params = new URL(req.url).searchParams;
    const limitParam = params.get('limit');
    const cursorParam = params.get('cursor');

    if (limitParam === null && cursorParam === null) {
      const rows = await db.select().from(chats).orderBy(desc(rowid));
      return Response.json({ chats: rows }, { status: 200 });
    }

    const limit = limitParam === null ? null : parsePositiveInt(limitParam);
    if (limitParam !== null && (limit === null || limit > MAX_LIMIT)) {
      return Response.json(
        { message: `limit must be an integer from 1 to ${MAX_LIMIT}` },
        { status: 400 },
      );
    }

    const cursor = cursorParam === null ? null : parsePositiveInt(cursorParam);
    if (cursorParam !== null && cursor === null) {
      return Response.json({ message: 'Invalid cursor' }, { status: 400 });
    }

    const query = db
      .select({ ...getTableColumns(chats), rowid })
      .from(chats)
      .where(cursor === null ? undefined : lt(rowid, cursor))
      .orderBy(desc(rowid));
    const rows = limit === null ? await query : await query.limit(limit + 1);

    const hasMore = limit !== null && rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return Response.json(
      {
        chats: page.map(({ rowid: _rowid, ...chat }) => chat),
        nextCursor: hasMore ? String(page[page.length - 1].rowid) : null,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
