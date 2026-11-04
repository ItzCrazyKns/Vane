import { z } from 'zod';

/** Turns kept for the model; the client sends two tuples per message. */
export const MAX_HISTORY_TURNS = 1000;

/** Hard bound on the accepted array so an oversized body is still refused. */
export const MAX_HISTORY_TUPLES = 100000;

/**
 * Chat history sent by the client, two tuples per message.
 *
 * A hard cap on the array used to reject any conversation longer than a few
 * hundred messages, and the client never saw that 400 as a stream event, so
 * the chat stayed in its loading state. Keep a bound against oversized
 * bodies, then use the most recent turns instead of failing the request.
 */
export const chatHistorySchema = z
  .array(z.tuple([z.string(), z.string()]))
  .max(MAX_HISTORY_TUPLES, { message: 'Chat history is too large.' })
  .transform((history) => history.slice(-MAX_HISTORY_TURNS))
  .optional()
  .default([]);
