import { useChat } from '@/lib/hooks/useChat';
import { useState } from 'react';
import { toast } from 'sonner';

const AttachmentReindexNotice = () => {
  const {
    filesNeedingReindex,
    fileIds,
    embeddingModelProvider,
    loading,
    clearReindexNotice,
    removeAttachment,
  } = useChat();
  const [rebuildingFileId, setRebuildingFileId] = useState<string | null>(null);

  const affectedFiles = filesNeedingReindex.filter((file) =>
    fileIds.includes(file.fileId),
  );

  if (affectedFiles.length === 0) return null;

  const rebuild = async (fileId: string) => {
    setRebuildingFileId(fileId);
    try {
      const response = await fetch('/api/uploads/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          embeddingModel: embeddingModelProvider,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(
          error?.message || 'Failed to rebuild attachment index.',
        );
      }

      clearReindexNotice(fileId);
      toast.success(
        'Attachment index rebuilt. Send your message again to retry.',
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to rebuild attachment index.',
      );
    } finally {
      setRebuildingFileId(null);
    }
  };

  return (
    <div className="mb-2 space-y-2 rounded-xl border border-light-200 bg-light-secondary p-3 text-xs text-black/80 dark:border-dark-200 dark:bg-dark-secondary dark:text-white/80">
      <p role="alert" className="font-medium">
        Rebuild or skip these attachments before sending your message.
      </p>
      <p>
        Rebuilding processes the file text with the current embedding model (
        {embeddingModelProvider.key}).
      </p>
      <ul className="max-h-36 space-y-1 overflow-y-auto">
        {affectedFiles.map(({ fileId, fileName, canReindex }) => (
          <li key={fileId} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 break-all">{fileName}</span>
            {canReindex !== false && (
              <button
                type="button"
                aria-label={`Rebuild index for ${fileName}`}
                disabled={loading || rebuildingFileId !== null}
                onClick={() => rebuild(fileId)}
                className="rounded border border-light-200 px-2 py-1 hover:bg-light-primary disabled:opacity-50 dark:border-dark-200 dark:hover:bg-dark-primary"
              >
                {rebuildingFileId === fileId ? 'Rebuilding…' : 'Rebuild'}
              </button>
            )}
            <button
              type="button"
              aria-label={`Skip for now: ${fileName}`}
              disabled={loading || rebuildingFileId !== null}
              onClick={() => removeAttachment(fileId)}
              className="rounded px-2 py-1 hover:bg-light-primary disabled:opacity-50 dark:hover:bg-dark-primary"
            >
              Skip for now
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AttachmentReindexNotice;
