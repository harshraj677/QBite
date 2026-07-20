'use client';

import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from './auth-provider';
import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';

/**
 * Composition order matters: Theme outermost (nothing below should
 * ever render before the `dark`/`light` class is resolved, or it
 * flashes the wrong theme), then Query (data layer), then Auth (needs
 * the query client for nothing yet, but will), then Tooltip (a Radix/
 * base-ui-style context every interactive primitive expects to find).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryProvider>
        <AuthProvider>
          <TooltipProvider delay={200}>
            {children}
            <Toaster richColors closeButton position="top-right" />
          </TooltipProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
