'use client';

import { Laptop, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useAuth } from '@/providers/auth-provider';
import type { AdminPanelRole } from '@/types/auth';
import { visibleNavSections } from './nav-config';

const CommandPaletteContext = createContext<Dispatch<SetStateAction<boolean>> | null>(null);

/** Lets any control (the topbar's "Search..." button, a future keyboard-shortcuts help screen, ...) open the same palette instance the Ctrl/Cmd+K listener drives, instead of each needing its own copy of the open/close state. */
export function useCommandPalette() {
  const setOpen = useContext(CommandPaletteContext);
  if (!setOpen) throw new Error('useCommandPalette must be used within a CommandPaletteProvider.');
  return { open: () => setOpen(true) };
}

/**
 * Global Ctrl/Cmd+K palette — the sidebar's `NAV_SECTIONS` data
 * doubles as this palette's contents (see nav-config.ts), so "every
 * page reachable from the sidebar" and "every page reachable from the
 * palette" are structurally the same list, not two lists a future
 * change can let drift apart.
 */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const sections = visibleNavSections((user?.role as AdminPanelRole) ?? 'kitchen_staff');

  return (
    <CommandPaletteContext.Provider value={setOpen}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command Palette"
        description="Jump to any page or run a quick action"
      >
        <CommandInput placeholder="Search pages, actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {sections.map((section) => (
            <CommandGroup key={section.title} heading={section.title}>
              {section.items.map((item) => (
                <CommandItem key={item.href} value={item.title} onSelect={() => go(item.href)}>
                  <item.icon />
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Theme">
            <CommandItem value="Light theme" onSelect={() => setTheme('light')}>
              <Sun />
              Light
            </CommandItem>
            <CommandItem value="Dark theme" onSelect={() => setTheme('dark')}>
              <Moon />
              Dark
            </CommandItem>
            <CommandItem value="System theme" onSelect={() => setTheme('system')}>
              <Laptop />
              System
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  );
}
