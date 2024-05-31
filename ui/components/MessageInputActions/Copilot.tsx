import { cn } from '@/lib/utils';
import { Switch } from '@headlessui/react';

const CopilotToggle = ({
  copilotEnabled,
  setCopilotEnabled,
}: {
  copilotEnabled: boolean;
  setCopilotEnabled: (enabled: boolean) => void;
}) => {
  return (
    <div className="group flex flex-row items-center space-x-1 active:scale-95 duration-200 transition cursor-pointer">
      <Switch
        checked={copilotEnabled}
        onChange={setCopilotEnabled}
        className="bg-light-secondary dark:bg-dark-secondary border border-light-200/70 dark:border-dark-200 relative inline-flex h-5 w-10 sm:h-6 sm:w-11 items-center rounded-full"
      >
        <span className="sr-only">Copilot</span>
        <span
          className={cn(
            copilotEnabled
              ? 'translate-x-6 bg-[#24A0ED]'
              : 'translate-x-1 bg-black/50 dark:bg-white/50',
            'inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full transition-all duration-200',
          )}
        />
      </Switch>
      <p
        onClick={() => setCopilotEnabled(!copilotEnabled)}
        className={cn(
          'text-xs font-medium transition-colors duration-150 ease-in-out',
          copilotEnabled
            ? 'text-[#24A0ED]'
            : 'text-black/50 dark:text-white/50 group-hover:text-black dark:group-hover:text-white',
        )}
      >
        Copilot
      </p>
    </div>
  );
};

export default CopilotToggle;
