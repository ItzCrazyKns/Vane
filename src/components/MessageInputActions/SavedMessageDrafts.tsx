import { useComposerDraft } from '@/lib/hooks/useChat';

const SavedMessageDrafts = () => {
  const { savedDrafts, restoreDraft } = useComposerDraft();
  if (!savedDrafts.length) return null;

  return (
    <ul
      aria-label="Saved message drafts"
      className="mb-2 max-h-32 space-y-1 overflow-y-auto rounded-xl border border-light-200 bg-light-secondary p-3 text-xs text-black/80 dark:border-dark-200 dark:bg-dark-secondary dark:text-white/80"
    >
      {savedDrafts.map((draft, index) => (
        <li key={index} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate">{draft}</span>
          <button
            type="button"
            onClick={() => restoreDraft(index)}
            className="shrink-0 rounded border border-light-200 px-2 py-1 hover:bg-light-primary dark:border-dark-200 dark:hover:bg-dark-primary"
          >
            Restore draft
          </button>
        </li>
      ))}
    </ul>
  );
};

export default SavedMessageDrafts;
