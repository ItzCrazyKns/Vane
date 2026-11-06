'use client';

import { CheckIcon, CopyIcon } from '@phosphor-icons/react';
import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import darkTheme from './CodeBlockDarkTheme';
import lightTheme from './CodeBlockLightTheme';

// O highlighter (highlight.js) fica num chunk à parte, baixado no primeiro
// bloco de código. Até lá o código aparece sem cores, na mesma caixa.
const SyntaxHighlighterComponent = lazy(
  () =>
    import('./highlighter') as unknown as Promise<{
      default: React.ComponentType<any>;
    }>,
);

const CodeBlock = ({
  language,
  children,
}: {
  language: string;
  children: React.ReactNode;
}) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const syntaxTheme = useMemo(() => {
    if (!mounted) return lightTheme;
    return resolvedTheme === 'dark' ? darkTheme : lightTheme;
  }, [mounted, resolvedTheme]);

  return (
    <div className="relative">
      <button
        className="absolute top-2 right-2 p-1"
        onClick={() => {
          navigator.clipboard.writeText(children as string);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? (
          <CheckIcon
            size={16}
            className="absolute top-2 right-2 text-black/70 dark:text-white/70"
          />
        ) : (
          <CopyIcon
            size={16}
            className="absolute top-2 right-2 transition duration-200 text-black/70 dark:text-white/70 hover:text-gray-800/70 hover:dark:text-gray-300/70"
          />
        )}
      </button>
      <Suspense
        fallback={
          <pre style={syntaxTheme.hljs}>
            <code
              className={language ? `language-${language}` : undefined}
              style={{ whiteSpace: 'pre' }}
            >
              {children as string}
            </code>
          </pre>
        }
      >
        <SyntaxHighlighterComponent
          language={language}
          style={syntaxTheme}
          showInlineLineNumbers
        >
          {children as string}
        </SyntaxHighlighterComponent>
      </Suspense>
    </div>
  );
};

export default CodeBlock;
