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

    let closed = false;
    // subscribe() replays past events synchronously, so for a session that
    // already finished the 'end' event fires before `disconnect` is assigned.
    // Track the unsubscribe function in a mutable variable and close once.
    let disconnect: (() => void) | undefined;

    const closeStream = () => {
      if (closed) return;
      closed = true;
      disconnect?.();
      writer.close().catch(() => undefined);
    };

    disconnect = session.subscribe((event, data) => {
      if (closed) return;

      if (event === 'data') {
        if (data.type === 'block') {
          writer.write(
            encoder.encode(
              JSON.stringify({
                type: 'block',
                block: data.block,
              }) + '\n',
            ),
          );
        } else if (data.type === 'updateBlock') {
          writer.write(
            encoder.encode(
              JSON.stringify({
                type: 'updateBlock',
                blockId: data.blockId,
                patch: data.patch,
              }) + '\n',
            ),
          );
        } else if (data.type === 'researchComplete') {
          writer.write(
            encoder.encode(
              JSON.stringify({
                type: 'researchComplete',
              }) + '\n',
            ),
          );
        }
      } else if (event === 'end') {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'messageEnd',
            }) + '\n',
          ),
        );
        closeStream();
      } else if (event === 'error') {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'error',
              data: data.data,
            }) + '\n',
          ),
        );
        closeStream();
      }
    });

    // If the replay already closed the stream, unsubscribe now that the
    // disconnect function exists.
    if (closed) disconnect();

    req.signal.addEventListener('abort', closeStream);

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
