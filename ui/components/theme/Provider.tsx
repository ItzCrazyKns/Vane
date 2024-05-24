'use client';
import { ThemeProvider } from 'next-themes';

export function ThemeProviderComponent({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" enableSystem={false} defaultTheme="dark">
      {children}
    </ThemeProvider>
  );
}
