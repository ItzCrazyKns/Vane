/* Opens the replay stream of a running answer. Returns null when the
   session is gone (404 after a restart or the 30-minute TTL), the server
   failed, or the network is down, so the caller can stop loading instead
   of waiting on a body that will never carry a messageEnd. */
export const openReconnectStream = async (
  backendId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReadableStream<Uint8Array> | null> => {
  try {
    const res = await fetchImpl(`/api/reconnect/${backendId}`, {
      method: 'POST',
    });

    if (!res.ok || !res.body) {
      await res.body?.cancel().catch(() => undefined);
      return null;
    }

    return res.body;
  } catch (err) {
    console.error('Failed to reconnect to the answer stream:', err);
    return null;
  }
};
