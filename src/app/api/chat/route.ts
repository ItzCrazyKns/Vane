import { z } from 'zod';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import SearchAgent, { ChatRewriteConflict } from '@/lib/agents/search';
import SessionManager from '@/lib/session';
import { streamChatSession } from '@/lib/chatStream';
import { ChatTurnMessage } from '@/lib/types';
import { SearchSources } from '@/lib/agents/search/types';
import db from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { chats, messages } from '@/lib/db/schema';
import UploadManager from '@/lib/uploads/manager';
import UploadStore, { AttachmentReindexRequired } from '@/lib/uploads/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
  content: z.string().min(1, 'Message content is required'),
});

const chatModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({ message: 'Chat model provider id must be provided' }),
  key: z.string({ message: 'Chat model key must be provided' }),
});

const embeddingModelSchema: z.ZodType<ModelWithProvider> = z.object({
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
});

type Body = z.infer<typeof bodySchema>;

const safeValidateBody = (data: unknown) => {
  const result = bodySchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((e: any) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }

  return {
    success: true,
    data: result.data,
  };
};

const ensureChatExists = async (input: {
  id: string;
  sources: SearchSources[];
  query: string;
  fileIds: string[];
}) => {
  try {
    const exists = await db.query.chats
      .findFirst({
        where: eq(chats.id, input.id),
      })
      .execute();

    if (!exists) {
      await db.insert(chats).values({
        id: input.id,
        createdAt: new Date().toISOString(),
        sources: input.sources,
        title: input.query,
        files: input.fileIds.map((id) => {
          return {
            fileId: id,
            name: UploadManager.getFile(id)?.name || 'Uploaded File',
          };
        }),
      });
    }
  } catch (err) {
    console.error('Failed to check/save chat:', err);
  }
};

export const POST = async (req: Request) => {
  try {
    const reqBody = (await req.json()) as Body;

    const parseBody = safeValidateBody(reqBody);

    if (!parseBody.success) {
      return Response.json(
        { message: 'Invalid request body', error: parseBody.error },
        { status: 400 },
      );
    }

    const body = parseBody.data as Body;
    const { message } = body;

    if (message.content === '') {
      return Response.json(
        {
          message: 'Please provide a message to process',
        },
        { status: 400 },
      );
    }

    const registry = new ModelRegistry();

    const embedding = await registry.loadEmbeddingModel(
      body.embeddingModel.providerId,
      body.embeddingModel.key,
    );
    const uploads = body.files.length
      ? new UploadStore({
          fileIds: body.files,
          embeddingModel: embedding,
          fingerprint: embedding.getIndexFingerprint(
            body.embeddingModel.providerId,
          ),
        })
      : undefined;
    const llm = await registry.loadChatModel(
      body.chatModel.providerId,
      body.chatModel.key,
    );

    const history: ChatTurnMessage[] = body.history.map((msg) => {
      if (msg[0] === 'human') {
        return {
          role: 'user',
          content: msg[1],
        };
      } else {
        return {
          role: 'assistant',
          content: msg[1],
        };
      }
    });

    const agent = new SearchAgent();
    const session = SessionManager.createSession();

    const response = streamChatSession(session, req.signal);

    agent
      .searchAsync(session, {
        chatHistory: history,
        followUp: message.content,
        chatId: body.message.chatId,
        messageId: body.message.messageId,
        config: {
          llm,
          embedding: embedding,
          sources: body.sources as SearchSources[],
          mode: body.optimizationMode,
          fileIds: body.files,
          uploads,
          systemInstructions: body.systemInstructions || 'None',
        },
      })
      .catch(async (error: unknown) => {
        const needsReindex = error instanceof AttachmentReindexRequired;
        const rewriteConflict = error instanceof ChatRewriteConflict;
        if (!needsReindex && !rewriteConflict) {
          console.error('Chat processing failed:', error);
        }

        try {
          const currentTurn = and(
            eq(messages.chatId, message.chatId),
            eq(messages.messageId, message.messageId),
            eq(messages.backendId, session.id),
            eq(messages.status, 'answering'),
          );
          if (needsReindex) {
            // Roll back only this request's pending row so the user can retry the turn.
            await db.delete(messages).where(currentTurn);
          } else if (!rewriteConflict) {
            await db
              .update(messages)
              .set({ status: 'error' })
              .where(currentTurn);
          }
        } catch (persistenceError) {
          console.error(
            'Failed to finish unsuccessful chat turn:',
            persistenceError,
          );
        }
        session.emit('error', {
          data: needsReindex
            ? error.toResponse()
            : rewriteConflict
              ? { code: 'CHAT_REWRITE_CONFLICT', message: error.message }
              : 'An error occurred while processing chat request',
        });
      });

    ensureChatExists({
      id: body.message.chatId,
      sources: body.sources as SearchSources[],
      fileIds: body.files,
      query: body.message.content,
    });

    return response;
  } catch (err) {
    if (err instanceof AttachmentReindexRequired) {
      return Response.json(err.toResponse(), { status: 409 });
    }
    console.error('An error occurred while processing chat request:', err);
    return Response.json(
      { message: 'An error occurred while processing chat request' },
      { status: 500 },
    );
  }
};
