/**
 * Tests for the chat API request body validation (Zod schema)
 * and reasoning pass-through logic.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Reproduce the exact schemas from src/app/api/chat/route.ts
const messageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
  content: z.string().min(1, 'Message content is required'),
});

const chatModelSchema = z.object({
  providerId: z.string({
    message: 'Chat model provider id must be provided',
  }),
  key: z.string({ message: 'Chat model key must be provided' }),
});

const embeddingModelSchema = z.object({
  providerId: z.string({
    message: 'Embedding model provider id must be provided',
  }),
  key: z.string({ message: 'Embedding model key must be provided' }),
});

const bodySchema = z.object({
  message: messageSchema,
  optimizationMode: z.enum(['speed', 'balanced', 'quality'], {
    message: 'Optimization mode must be one of: speed, balanced, quality',
  }),
  sources: z.array(z.string()).optional().default([]),
  history: z
    .array(z.tuple([z.string(), z.string()]))
    .optional()
    .default([]),
  files: z.array(z.string()).optional().default([]),
  chatModel: chatModelSchema,
  embeddingModel: embeddingModelSchema,
  systemInstructions: z.string().nullable().optional().default(''),
  reasoning: z
    .object({
      enabled: z.boolean(),
      effort: z.string().optional(),
    })
    .optional(),
});

function validBody(overrides: Record<string, any> = {}) {
  return {
    message: {
      messageId: 'msg-1',
      chatId: 'chat-1',
      content: 'What is TypeScript?',
    },
    optimizationMode: 'balanced',
    chatModel: { providerId: 'prov-1', key: 'gpt-4o' },
    embeddingModel: { providerId: 'prov-1', key: 'text-embedding-3-small' },
    ...overrides,
  };
}

describe('Chat body schema: valid requests', () => {
  it('accepts a minimal valid body', () => {
    const result = bodySchema.safeParse(validBody());
    expect(result.success).toBe(true);
  });

  it('defaults optional fields', () => {
    const result = bodySchema.safeParse(validBody());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sources).toEqual([]);
      expect(result.data.history).toEqual([]);
      expect(result.data.files).toEqual([]);
      expect(result.data.systemInstructions).toBe('');
      expect(result.data.reasoning).toBeUndefined();
    }
  });

  it('accepts all three optimization modes', () => {
    for (const mode of ['speed', 'balanced', 'quality']) {
      const result = bodySchema.safeParse(
        validBody({ optimizationMode: mode }),
      );
      expect(result.success).toBe(true);
    }
  });

  it('accepts sources array', () => {
    const result = bodySchema.safeParse(
      validBody({ sources: ['web', 'academic'] }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sources).toEqual(['web', 'academic']);
    }
  });

  it('accepts history tuples', () => {
    const result = bodySchema.safeParse(
      validBody({
        history: [
          ['human', 'hello'],
          ['assistant', 'hi there'],
        ],
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe('Chat body schema: reasoning field', () => {
  it('accepts reasoning with enabled=true and effort', () => {
    const result = bodySchema.safeParse(
      validBody({ reasoning: { enabled: true, effort: 'high' } }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reasoning).toEqual({
        enabled: true,
        effort: 'high',
      });
    }
  });

  it('accepts reasoning with enabled=false', () => {
    const result = bodySchema.safeParse(
      validBody({ reasoning: { enabled: false } }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reasoning!.enabled).toBe(false);
    }
  });

  it('accepts reasoning without effort (defaults to undefined)', () => {
    const result = bodySchema.safeParse(
      validBody({ reasoning: { enabled: true } }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reasoning!.enabled).toBe(true);
      expect(result.data.reasoning!.effort).toBeUndefined();
    }
  });

  it('accepts all effort levels', () => {
    for (const effort of ['low', 'medium', 'high']) {
      const result = bodySchema.safeParse(
        validBody({ reasoning: { enabled: true, effort } }),
      );
      expect(result.success).toBe(true);
    }
  });

  it('rejects reasoning with non-boolean enabled', () => {
    const result = bodySchema.safeParse(
      validBody({ reasoning: { enabled: 'yes' } }),
    );
    expect(result.success).toBe(false);
  });
});

describe('Chat body schema: invalid requests', () => {
  it('rejects missing message', () => {
    const { message, ...rest } = validBody();
    expect(bodySchema.safeParse(rest).success).toBe(false);
  });

  it('rejects empty message content', () => {
    const result = bodySchema.safeParse(
      validBody({
        message: { messageId: 'msg-1', chatId: 'chat-1', content: '' },
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects missing chatModel', () => {
    const { chatModel, ...rest } = validBody();
    expect(bodySchema.safeParse(rest).success).toBe(false);
  });

  it('rejects missing embeddingModel', () => {
    const { embeddingModel, ...rest } = validBody();
    expect(bodySchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid optimization mode', () => {
    const result = bodySchema.safeParse(
      validBody({ optimizationMode: 'turbo' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects missing optimization mode', () => {
    const { optimizationMode, ...rest } = validBody();
    expect(bodySchema.safeParse(rest).success).toBe(false);
  });

  it('rejects non-object body', () => {
    expect(bodySchema.safeParse('hello').success).toBe(false);
    expect(bodySchema.safeParse(null).success).toBe(false);
    expect(bodySchema.safeParse(42).success).toBe(false);
  });
});

describe('Chat body schema: model provider fields', () => {
  it('requires providerId on chatModel', () => {
    const result = bodySchema.safeParse(
      validBody({ chatModel: { key: 'gpt-4o' } }),
    );
    expect(result.success).toBe(false);
  });

  it('requires key on chatModel', () => {
    const result = bodySchema.safeParse(
      validBody({ chatModel: { providerId: 'prov-1' } }),
    );
    expect(result.success).toBe(false);
  });

  it('requires providerId on embeddingModel', () => {
    const result = bodySchema.safeParse(
      validBody({
        embeddingModel: { key: 'text-embedding-3-small' },
      }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts model keys with slashes (e.g., openrouter models)', () => {
    const result = bodySchema.safeParse(
      validBody({
        chatModel: {
          providerId: 'prov-1',
          key: 'anthropic/claude-3.5-sonnet',
        },
      }),
    );
    expect(result.success).toBe(true);
  });
});
