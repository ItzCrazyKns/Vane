import SessionManager from '@/lib/session';

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const session = SessionManager.getSession(id);

    if (!session) {
      return Response.json({ message: 'Session not found' }, { status: 404 });
    }

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();
    const keepAliveMs = 15_000;
    let streamClosed = false;
    let keepAliveInterval: ReturnType<typeof setInterval> | undefined;

    const safeWrite = (payload: Record<string, unknown>) => {
      if (streamClosed) return;

      try {
        writer.write(encoder.encode(JSON.stringify(payload) + '\n'));
      } catch (error) {
        console.warn('Failed to write reconnect stream payload:', error);
      }
    };

    const safeClose = () => {
      if (streamClosed) return;

      streamClosed = true;

      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
      }

      try {
        writer.close();
      } catch (error) {
        console.warn('Failed to close reconnect stream:', error);
      }
    };

    keepAliveInterval = setInterval(() => {
      safeWrite({ type: 'keepAlive' });
    }, keepAliveMs);

    safeWrite({ type: 'keepAlive' });

    const disconnect = session.subscribe((event, data) => {
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
        safeClose();
        disconnect();
      } else if (event === 'error') {
        safeWrite({
          type: 'error',
          data: data.data,
        });
        safeClose();
        disconnect();
      }
    });

    req.signal.addEventListener('abort', () => {
      disconnect();
      safeClose();
    });

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    console.error('Error in reconnecting to session stream: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
