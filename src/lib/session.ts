import { EventEmitter } from 'stream';
import { applyPatch } from 'rfc6902';
import { Block } from './types';

const sessions =
  (global as any)._sessionManagerSessions || new Map<string, SessionManager>();
if (process.env.NODE_ENV !== 'production') {
  (global as any)._sessionManagerSessions = sessions;
}

class SessionManager {
  private static sessions: Map<string, SessionManager> = sessions;
  readonly id: string;
  private blocks = new Map<string, Block>();
  private events: { event: string; data: any }[] = [];
  private emitter = new EventEmitter();
  private TTL_MS = 30 * 60 * 1000;
  private ttlTimer: ReturnType<typeof setTimeout>;

  constructor(id?: string) {
    this.id = id ?? crypto.randomUUID();

    this.ttlTimer = setTimeout(() => {
      this.cleanup();
    }, this.TTL_MS);
  }

  /** Remove session from map, clear timer and all listeners. */
  cleanup() {
    clearTimeout(this.ttlTimer);
    this.emitter.removeAllListeners();
    SessionManager.sessions.delete(this.id);
  }

  static getSession(id: string): SessionManager | undefined {
    return this.sessions.get(id);
  }

  static getAllSessions(): SessionManager[] {
    return Array.from(this.sessions.values());
  }

  static createSession(): SessionManager {
    const session = new SessionManager();
    this.sessions.set(session.id, session);
    return session;
  }

  removeAllListeners() {
    this.emitter.removeAllListeners();
  }

  emit(event: string, data: any) {
    this.emitter.emit(event, data);
    this.events.push({ event, data });
  }

  emitBlock(block: Block) {
    this.blocks.set(block.id, block);
    this.emit('data', {
      type: 'block',
      block: block,
    });
  }

  getBlock(blockId: string): Block | undefined {
    return this.blocks.get(blockId);
  }

  updateBlock(blockId: string, patch: any[]) {
    const block = this.blocks.get(blockId);

    if (block) {
      applyPatch(block, patch);
      this.blocks.set(blockId, block);
      this.emit('data', {
        type: 'updateBlock',
        blockId: blockId,
        patch: patch,
      });
    }
  }

  getAllBlocks() {
    return Array.from(this.blocks.values());
  }

  subscribe(listener: (event: string, data: any) => void): () => void {
    const handler = (event: string) => (data: any) => listener(event, data);
    const dataHandler = handler('data');
    const endHandler = handler('end');
    const errorHandler = handler('error');

    this.emitter.on('data', dataHandler);
    this.emitter.on('end', endHandler);
    this.emitter.on('error', errorHandler);

    // Send the current state of each block as a snapshot rather than
    // replaying every historical event. The old approach replayed all
    // block creation + every incremental updateBlock patch, which caused
    // reconnecting clients to visually rebuild (and effectively duplicate)
    // content they had already received before the connection dropped.
    for (const block of this.blocks.values()) {
      listener('data', { type: 'block', block: structuredClone(block) });
    }

    // Replay any non-block milestone events (researchComplete, end, error)
    // so reconnecting subscribers know if the session already finished.
    for (const { event, data } of this.events) {
      if (event === 'end' || event === 'error') {
        listener(event, data);
      } else if (event === 'data' && data.type === 'researchComplete') {
        listener(event, data);
      }
    }

    return () => {
      this.emitter.off('data', dataHandler);
      this.emitter.off('end', endHandler);
      this.emitter.off('error', errorHandler);
    };
  }
}

export default SessionManager;
