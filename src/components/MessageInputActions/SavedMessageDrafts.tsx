import { useChat, useComposerDraft } from '@/lib/hooks/useChat';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const actionClassName =
  'shrink-0 rounded border border-light-200 px-2 py-1 hover:bg-light-primary disabled:opacity-50 dark:border-dark-200 dark:hover:bg-dark-primary';

const summarize = (text: string) => {
  const preview = text.trim().replace(/\s+/g, ' ');
  return preview.length > 72 ? preview.slice(0, 71) + '…' : preview;
};

const SavedMessageDrafts = () => {
  const { draft, savedDrafts, restoreDraft, discardRecovery } =
    useComposerDraft();
  const {
    chatId,
    files,
    sources,
    filesNeedingReindex,
    messages,
    loading,
    clearReindexNotice,
  } = useChat();
  const [discarding, setDiscarding] = useState(false);
  const current = useRef({
    draft,
    savedDrafts,
    messages,
    loading,
    filesNeedingReindex,
  });

  useEffect(() => {
    current.current = {
      draft,
      savedDrafts,
      messages,
      loading,
      filesNeedingReindex,
    };
  }, [draft, savedDrafts, messages, loading, filesNeedingReindex]);

  const { recoveryId: activeRecoveryId } = draft;
  if (!savedDrafts.length && !activeRecoveryId) return null;

  const actionsDisabled = !chatId || loading || discarding;

  const discard = async (recoveryId: string) => {
    if (!chatId || actionsDisabled) return;
    setDiscarding(true);
    const chatPath = '/c/' + encodeURIComponent(chatId);
    const chatEndpoint = '/api/chats/' + encodeURIComponent(chatId);

    try {
      const response = await fetch(chatEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryIds: [recoveryId] }),
      });

      if (!response.ok) throw new Error('Could not discard this draft.');

      discardRecovery(chatId, recoveryId);
      if (window.location.pathname !== chatPath) return;

      const { draft, savedDrafts, messages, loading, filesNeedingReindex } =
        current.current;
      const discardingActiveDraft = draft.recoveryId === recoveryId;

      if (discardingActiveDraft && !savedDrafts[0]?.attachments) {
        for (const file of filesNeedingReindex) clearReindexNotice(file.fileId);
      }

      const hasOtherRecovery = [draft, ...savedDrafts].some(
        (draft) => draft.recoveryId && draft.recoveryId !== recoveryId,
      );

      if (!messages.length && !loading && !hasOtherRecovery) {
        // A different tab may have saved a new message or recovery.
        const detail = await fetch(chatEndpoint + '?recover=1').catch(
          () => null,
        );
        if (
          detail?.status === 404 &&
          window.location.pathname === chatPath &&
          !current.current.messages.length &&
          !current.current.loading
        ) {
          window.history.replaceState(null, '', '/');
        }
      }
    } catch {
      toast.error('Could not discard this draft.');
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <div className="mb-2 max-h-32 space-y-1 overflow-y-auto rounded-xl border border-light-200 bg-light-secondary p-3 text-xs text-black/80 dark:border-dark-200 dark:bg-dark-secondary dark:text-white/80">
      {activeRecoveryId && (
        <div className="flex items-center justify-between gap-2">
          <span>Recovered draft</span>
          <button
            type="button"
            aria-label="Discard draft in composer"
            disabled={actionsDisabled}
            onClick={() => discard(activeRecoveryId)}
            className={actionClassName}
          >
            Discard draft
          </button>
        </div>
      )}
      {!!savedDrafts.length && (
        <ul aria-label="Saved message drafts" className="space-y-1">
          {savedDrafts.map((draft, index) => {
            const { recoveryId } = draft;
            const attachmentNames = draft.attachments?.files
              .map((file) => file.fileName)
              .join(', ');
            const attachmentText = draft.attachments
              ? attachmentNames || 'No attachments'
              : '';
            const label = [
              index + 1,
              summarize(draft.text) || 'Empty draft',
              summarize(attachmentText),
            ]
              .filter(Boolean)
              .join(', ');

            return (
              <li
                key={recoveryId ?? index}
                className="flex flex-wrap items-center gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate" title={draft.text}>
                    {draft.text || 'Empty draft'}
                  </p>
                  {attachmentText && (
                    <p className="truncate opacity-80" title={attachmentText}>
                      {attachmentText}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Restore draft ${label}`}
                  disabled={actionsDisabled}
                  onClick={() =>
                    restoreDraft(index, { files, sources, filesNeedingReindex })
                  }
                  className={actionClassName}
                >
                  Restore draft
                </button>
                {recoveryId && (
                  <button
                    type="button"
                    aria-label={`Discard draft ${label}`}
                    disabled={actionsDisabled}
                    onClick={() => discard(recoveryId)}
                    className={actionClassName}
                  >
                    Discard draft
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SavedMessageDrafts;
