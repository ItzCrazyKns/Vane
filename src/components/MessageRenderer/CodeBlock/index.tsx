'use client';

import { CheckIcon, CopyIcon } from '@phosphor-icons/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';
import SyntaxHighlighter from 'react-syntax-highlighter';
import darkTheme from './CodeBlockDarkTheme';
import lightTheme from './CodeBlockLightTheme';
import { langIconMap, type DeviconComponent } from '@/lib/langIconMap';

const LangIcon = ({ language }: { language: string }) => {
  const [Icon, setIcon] = useState<DeviconComponent | null>(null);

  useEffect(() => {
    const loader = langIconMap[language?.toLowerCase()];
    if (loader) {
      loader().then((mod) => setIcon(() => mod.default)).catch(() => setIcon(null));
    }
  }, [language]);

  if (!Icon) return null;
  return <Icon size={13} />;
};

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
  const [headerVisible, setHeaderVisible] = useState(true);
  const [blockVisible, setBlockVisible] = useState(false);
  const [rightOffset, setRightOffset] = useState(16);

  const headerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const syntaxTheme = useMemo(() => {
    if (!mounted) return lightTheme;
    return resolvedTheme === 'dark' ? darkTheme : lightTheme;
  }, [mounted, resolvedTheme]);

  // Observer 1 — watch header visibility
  useEffect(() => {
    if (!headerRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setHeaderVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(headerRef.current);
    return () => obs.disconnect();
  }, [mounted]);

  // Observer 2 — watch block visibility + track right offset
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setBlockVisible(entry.isIntersecting);
        const rect = entry.boundingClientRect;
        setRightOffset(window.innerWidth - rect.right + 8);
      },
      { threshold: 0 }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [mounted]);

  // Only show float when header gone but block still visible
  const showFloat = mounted && !headerVisible && blockVisible;

  const handleCopy = () => {
    navigator.clipboard.writeText(children as string);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div ref={containerRef} className="relative my-3 rounded-lg" style={{ overflow: 'clip' }}>

      {/* Normal header */}
      <div ref={headerRef} className="flex items-center justify-between px-3 py-1.5 bg-[#2a2a2a] rounded-t-lg">
        <div className="flex items-center gap-1.5">
          <LangIcon language={language} />
          <span className="text-[11px] text-white/50 font-mono lowercase tracking-wide">
            {language || 'code'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          title="Copy code"
          className="text-white/40 hover:text-white/80 transition-all duration-200 active:scale-95 p-1"
        >
          {copied ? (
            <CheckIcon size={13} weight="bold" className="text-green-400" />
          ) : (
            <CopyIcon size={13} />
          )}
        </button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={language}
        style={syntaxTheme}
        showInlineLineNumbers
        customStyle={{ margin: 0, borderRadius: '0 0 8px 8px' }}
      >
        {children as string}
      </SyntaxHighlighter>

      {/* Floating pill — portaled to body, per-block independent */}
      {showFloat && createPortal(
        <div
          className="fixed top-2 z-[9999] flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2a2a2a] rounded-md shadow-lg border border-white/10"
          style={{ right: rightOffset }}
        >
          <LangIcon language={language} />
          <span className="text-[11px] text-white/40 font-mono lowercase tracking-wide">
            {language || 'code'}
          </span>
          <span className="w-px h-3 bg-white/10" />
          <button
            onClick={handleCopy}
            title="Copy code"
            className="text-white/40 hover:text-white/80 transition-all duration-200 active:scale-95"
          >
            {copied ? (
              <CheckIcon size={13} weight="bold" className="text-green-400" />
            ) : (
              <CopyIcon size={13} />
            )}
          </button>
        </div>,
        document.body
      )}

    </div>
  );
};

export default CodeBlock;
