import { cn } from '@/lib/utils';
import { Loader2, ChevronDown } from 'lucide-react';
import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: any; label: string; disabled?: boolean }[];
  loading?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, loading = false, disabled, ...restProps }, ref) => {
    return (
      <div
        className={cn(
          'relative inline-flex w-full items-center',
          disabled && 'opacity-60',
        )}
      >
        <select
          {...restProps}
          ref={ref}
          disabled={disabled || loading}
          className={cn(
            'bg-light-secondary dark:bg-dark-secondary px-3 py-2 flex items-center overflow-hidden border border-light-200 dark:border-dark-200 dark:text-white rounded-lg appearance-none w-full pr-10 text-xs lg:text-sm',
            className,
          )}
        >
          {options.map(({ label, value, disabled: optionDisabled }) => {
            return (
              <option key={value} value={value} disabled={optionDisabled}>
                {label}
              </option>
            );
          })}
        </select>
        <span className="pointer-events-none absolute right-3 flex h-4 w-4 items-center justify-center text-black/50 dark:text-white/60">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </div>
    );
  },
);

Select.displayName = 'Select';

export default Select;
