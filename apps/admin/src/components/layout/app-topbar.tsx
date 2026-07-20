'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Breadcrumbs } from './breadcrumbs';
import { useCommandPalette } from './command-palette';
import { NotificationsPopover } from './notifications-popover';
import { UserMenu } from './user-menu';

/** Renders "⌘K" on macOS, "Ctrl K" everywhere else — read once on mount so it never mismatches server-rendered markup (`navigator` doesn't exist during SSR). */
function useShortcutHint() {
  const [hint, setHint] = useState('Ctrl K');
  useEffect(() => {
    // `navigator` doesn't exist during SSR — this can only ever run
    // once, on mount, which is the narrow, acknowledged exception to
    // this rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setHint('⌘K');
  }, []);
  return hint;
}

export function AppTopbar() {
  const shortcutHint = useShortcutHint();
  const { open: openCommandPalette } = useCommandPalette();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-sm sm:px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="hidden w-56 justify-between text-muted-foreground font-normal sm:flex"
          onClick={openCommandPalette}
        >
          <span className="flex items-center gap-2">
            <Search className="size-3.5" />
            Search...
          </span>
          <Kbd>{shortcutHint}</Kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          className="sm:hidden"
          onClick={openCommandPalette}
        >
          <Search className="size-4" />
        </Button>

        <ThemeToggle />
        <NotificationsPopover />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <UserMenu />
      </div>
    </header>
  );
}
