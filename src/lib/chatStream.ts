import type SessionManager from './session';

export const streamChatSession = (
  session: SessionManager,
  signal: AbortSignal,
) => {
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let stop = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        stop();
        controller.close();
      };
      stop = () => {
        closed = true;
        unsubscribe();
        signal.removeEventListener('abort', close);
      };

      if (signal.aborted) {
        close();
        return;
      }
      signal.addEventListener('abort', close, { once: true });

      unsubscribe = session.subscribe((event, data) => {
        if (closed) return;

        if (event === 'end' || event === 'error') {
          const message =
            event === 'end'
              ? { type: 'messageEnd', recoveryId: data?.recoveryId }
              : { type: 'error', data: data.data };
          controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));
          close();
        } else if (
          event === 'data' &&
          ['block', 'updateBlock', 'researchComplete'].includes(data.type)
        ) {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
        }
      });

      // The terminal event can arrive during synchronous replay in subscribe().
      if (closed) unsubscribe();
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
};
