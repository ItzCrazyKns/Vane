import SessionManager from '@/lib/session';
import { getAuthEnabled, isAdmin } from '@/lib/auth';
import db from '@/lib/db';
import { messages, chats } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  let safeClose: (() => void) | undefined;
  let disconnect: (() => void) | undefined;

  try {
    const { id } = await params;

    const session = SessionManager.getSession(id);

    if (!session) {
      return Response.json({ message: 'Session not found' }, { status: 404 });
    }

    // Ownership check: verify this session belongs to the requesting user
    const authEnabled = getAuthEnabled();
    if (authEnabled) {
      const userId = req.headers.get('x-user-id');
      if (!userId) {
        return Response.json(
          { message: 'Authentication required' },
          { status: 401 },
        );
      }
      const msg = await db.query.messages.findFirst({
        where: eq(messages.backendId, id),
        columns: { chatId: true },
      });
      if (msg) {
        const chat = await db.query.chats.findFirst({
          where: eq(chats.id, msg.chatId),
          columns: { userId: true },
        });
        if (chat && chat.userId && chat.userId !== userId) {
          const admin = await isAdmin(userId);
          if (!admin) {
            return Response.json(
              { message: 'Session not found' },
              { status: 404 },
            );
          }
        }
      }
    }

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();
    const keepAliveMs = 15_000;
    let streamClosed = false;
    let keepAliveInterval: ReturnType<typeof setInterval> | undefined;

    const safeWrite = (payload: Record<string, unknown>) => {
      if (streamClosed) return;

      writer.write(encoder.encode(JSON.stringify(payload) + '\n')).catch((error) => {
        console.warn('Failed to write reconnect stream payload:', error);
        streamClosed = true;
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
        }
      });
    };

    safeClose = () => {
      if (streamClosed) return;

      streamClosed = true;

      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
      }

      writer.close().catch((error) => {
        console.warn('Failed to close reconnect stream:', error);
      });
    };

    disconnect = session.subscribe((event, data) => {
      if (event === 'data') {
        if (data.type === 'block') {
          safeWrite({
            type: 'block',
            block: data.block,
          });
        } else if (data.type === 'updateBlock') {
          safeWrite({
            type: 'updateBlock',
            blockId: data.blockId,
            patch: data.patch,
          });
        } else if (data.type === 'researchComplete') {
          safeWrite({
            type: 'researchComplete',
          });
        }
      } else if (event === 'end') {
        safeWrite({
          type: 'messageEnd',
        });
        safeClose?.();
        if (disconnect) {
          disconnect();
        } else {
          queueMicrotask(() => disconnect?.());
        }
      } else if (event === 'error') {
        safeWrite({
          type: 'error',
          data: data.data,
        });
        safeClose?.();
        if (disconnect) {
          disconnect();
        } else {
          queueMicrotask(() => disconnect?.());
        }
      }
    });

    req.signal.addEventListener('abort', () => {
      disconnect?.();
      safeClose?.();
    });

    // Start keepalives only after setup succeeds
    if (!streamClosed) {
      keepAliveInterval = setInterval(() => {
        safeWrite({ type: 'keepAlive' });
      }, keepAliveMs);
      safeWrite({ type: 'keepAlive' });
    }

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    disconnect?.();
    safeClose?.();
    console.error('Error in reconnecting to session stream: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
