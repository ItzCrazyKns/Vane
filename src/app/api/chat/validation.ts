import { z } from 'zod';

// Message schema
const messageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
  content: z.string().min(1, 'Message content is required'),
});

// ChatModel schema
const chatModelSchema = z.object({
  provider: z.string().optional(),
  name: z.string().optional(),
});

// EmbeddingModel schema
const embeddingModelSchema = z.object({
  provider: z.string().optional(),
  name: z.string().optional(),
});

// Main Body schema
export const bodySchema = z.object({
  message: messageSchema,
  optimizationMode: z.enum(['speed', 'balanced', 'quality'], {
    errorMap: () => ({
      message: 'Optimization mode must be one of: speed, balanced, quality',
    }),
  }),
  focusMode: z.string().min(1, 'Focus mode is required'),
  history: z
    .array(
      z.tuple([z.string(), z.string()], {
        errorMap: () => ({
          message: 'History items must be tuples of two strings',
        }),
      }),
    )
    .optional()
    .default([]),
  files: z.array(z.string()).optional().default([]),
  chatModel: chatModelSchema.optional().default({}),
  embeddingModel: embeddingModelSchema.optional().default({}),
  systemInstructions: z.string().optional().default(''),
});

export type Message = z.infer<typeof messageSchema>;
export type ChatModel = z.infer<typeof chatModelSchema>;
export type EmbeddingModel = z.infer<typeof embeddingModelSchema>;
export type ChatApiBody = z.infer<typeof bodySchema>;

// Safe validation that returns success/error
export function safeValidateBody(data: unknown) {
  const result = bodySchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
