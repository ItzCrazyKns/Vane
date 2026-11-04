import { z } from 'zod';

/** Tuples kept for the model; the client sends two tuples per message. */
export const MAX_HISTORY_TURNS = 1000;

/** Hard bound on the raw array so an oversized body is still refused. */
export const MAX_HISTORY_INPUT_TUPLES = 100000;

/**
 * Chat history sent by the client, two tuples per message.
 *
 * A hard cap on the array used to reject any conversation longer than a few
 * hundred messages, and the client never saw that 400 as a stream event, so
 * the chat stayed in its loading state. Keep a bound against oversized
 * bodies, then keep the most recent turns and validate only those, so a
 * malformed array cannot produce an error entry for every element.
 */
export const chatHistorySchema = z
  .array(z.unknown())
  .max(MAX_HISTORY_INPUT_TUPLES, { message: 'Chat history is too large.' })
  .transform((history) => history.slice(-MAX_HISTORY_TURNS))
  .pipe(z.array(z.tuple([z.string(), z.string()])))
  .optional()
  .default([]);
