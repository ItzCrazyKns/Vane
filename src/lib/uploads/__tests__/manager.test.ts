import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEmbedding } from '@/__tests__/helpers/fakes';

/* Uploads used to go to process.cwd()/data/uploads even when DATA_DIR pointed
   elsewhere, so they did not land on the data volume with the db and config. */
describe('upload folder and DATA_DIR', () => {
  let root: string;
  const originalDataDir = process.env.DATA_DIR;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vane-uploads-'));
    vi.resetModules();
  });

  afterEach(() => {
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
    fs.rmSync(root, { recursive: true, force: true });
  });

  describe('resolveUploadsDirs', () => {
    it('keeps cwd/data/uploads when DATA_DIR is unset', async () => {
      const { resolveUploadsDirs } = await import('../paths');
      expect(resolveUploadsDirs({ dataDir: undefined, cwd: '/app' })).toEqual({
        uploadsDir: path.join('/app', 'data', 'uploads'),
        legacyUploadsDir: null,
      });
    });

    it('uses DATA_DIR/data/uploads and keeps cwd/data/uploads as a read fallback', async () => {
      const { resolveUploadsDirs } = await import('../paths');
      expect(resolveUploadsDirs({ dataDir: '/vol', cwd: '/app' })).toEqual({
        uploadsDir: path.join('/vol', 'data', 'uploads'),
        legacyUploadsDir: path.join('/app', 'data', 'uploads'),
      });
    });

    it('has no fallback when DATA_DIR is the app folder', async () => {
      const { resolveUploadsDirs } = await import('../paths');
      expect(resolveUploadsDirs({ dataDir: '/app/', cwd: '/app' })).toEqual({
        uploadsDir: path.join('/app', 'data', 'uploads'),
        legacyUploadsDir: null,
      });
    });
  });

  it('UploadManager writes under DATA_DIR/data/uploads', async () => {
    process.env.DATA_DIR = path.join(root, 'vol');
    const { default: UploadManager } = await import('../manager');

    expect(UploadManager.uploadsDir).toBe(
      path.join(root, 'vol', 'data', 'uploads'),
    );

    const manager = new UploadManager({ embeddingModel: new FakeEmbedding() });
    const [res] = await manager.processFiles([
      new File(['rust memory safety'], 'notes.txt', { type: 'text/plain' }),
    ]);

    const file = UploadManager.getFile(res.fileId)!;
    expect(path.dirname(file.filePath)).toBe(UploadManager.uploadsDir);
    expect(UploadManager.getFileChunks(res.fileId)[0].content).toContain(
      'rust memory safety',
    );
  });

  it('still finds files uploaded to the old cwd/data/uploads, without moving them', async () => {
    const legacyDir = path.join(root, 'app', 'data', 'uploads');
    fs.mkdirSync(legacyDir, { recursive: true });
    const contentPath = path.join(legacyDir, 'old.content.json');
    fs.writeFileSync(
      contentPath,
      JSON.stringify({ chunks: [{ content: 'old chunk', embedding: [1] }] }),
    );
    fs.writeFileSync(
      path.join(legacyDir, 'uploaded_files.json'),
      JSON.stringify({
        files: [
          {
            id: 'old-id',
            name: 'old.txt',
            filePath: path.join(legacyDir, 'old.txt'),
            contentPath,
            uploadedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );

    process.env.DATA_DIR = path.join(root, 'vol');
    const { default: UploadManager } = await import('../manager');
    UploadManager.legacyUploadsDir = legacyDir;

    /* A new upload creates the record file in the new folder; the old one
       must still be readable afterwards. */
    const manager = new UploadManager({ embeddingModel: new FakeEmbedding() });
    const [res] = await manager.processFiles([
      new File(['new text'], 'new.txt', { type: 'text/plain' }),
    ]);

    expect(UploadManager.getFile('old-id')?.name).toBe('old.txt');
    expect(UploadManager.getFileChunks('old-id')).toEqual([
      { content: 'old chunk', embedding: [1] },
    ]);
    expect(UploadManager.getFile(res.fileId)?.name).toBe('new.txt');
    expect(UploadManager.getFile('missing')).toBeNull();

    /* Nothing was moved or rewritten in the old folder. */
    expect(fs.readdirSync(legacyDir).sort()).toEqual([
      'old.content.json',
      'uploaded_files.json',
    ]);
  });
});
