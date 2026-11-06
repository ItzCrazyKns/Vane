// TypeScript: makes sure each answer stream's 'messageEnd' event is handled once.
//
// The key is the stream, not the message. A rewrite re-sends the same
// messageId on a new stream (new backendId), so keying by messageId would
// skip the rewrite's messageEnd and leave the chat stuck in 'answering'.

// Returns true the first time a stream key is seen, false on any repeat.
export const claimMessageEnd = (
  handled: Set<string>,
  streamKey: string,
): boolean => {
  if (handled.has(streamKey)) return false;
  handled.add(streamKey);
  return true;
};
