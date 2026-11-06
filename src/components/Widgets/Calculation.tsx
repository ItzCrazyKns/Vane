'use client';

import { Calculator, Equal } from 'lucide-react';
import { useTranslations } from 'next-intl';

type CalculationWidgetProps = {
  expression: string;
  result: number;
};

const Calculation = ({ expression, result }: CalculationWidgetProps) => {
  const t = useTranslations('Calculation');
  return (
    <div className="rounded-lg border border-light-200 dark:border-dark-200">
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-black/60 dark:text-white/70">
            <Calculator className="w-4 h-4" />
            <span className="text-xs uppercase font-semibold tracking-wide">
              {t('expression')}
            </span>
          </div>
          <div className="rounded-lg border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary p-3">
            <code className="text-sm text-black dark:text-white font-mono break-all">
              {expression}
            </code>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-black/60 dark:text-white/70">
            <Equal className="w-4 h-4" />
            <span className="text-xs uppercase font-semibold tracking-wide">
              {t('result')}
            </span>
          </div>
          <div className="rounded-xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary p-5">
            <div className="text-4xl font-bold text-black dark:text-white font-mono tabular-nums">
              {result.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calculation;
