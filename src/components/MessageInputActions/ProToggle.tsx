import { Switch } from '@headlessui/react';
import { useChat } from '@/lib/hooks/useChat';
import { cn } from '@/lib/utils';

const ProToggle = () => {
  const { optimizationMode, setOptimizationMode } = useChat();
  const isPro = optimizationMode === 'quality';

  return (
    <div className="flex items-center gap-2">
      <span className={cn(
        "text-xs font-medium transition-colors",
        isPro ? "text-black/50 dark:text-white/50" : "text-[#24A0ED]"
      )}>
        Quick
      </span>
      <Switch
        checked={isPro}
        onChange={(checked) => setOptimizationMode(checked ? 'quality' : 'speed')}
        className={cn(
          isPro ? 'bg-[#24A0ED]' : 'bg-black/10 dark:bg-white/10',
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none'
        )}
      >
        <span
          className={cn(
            isPro ? 'translate-x-4' : 'translate-x-1',
            'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform'
          )}
        />
      </Switch>
      <span className={cn(
        "text-xs font-medium transition-colors",
        isPro ? "text-[#24A0ED]" : "text-black/50 dark:text-white/50"
      )}>
        Pro
      </span>
    </div>
  );
};

export default ProToggle;
