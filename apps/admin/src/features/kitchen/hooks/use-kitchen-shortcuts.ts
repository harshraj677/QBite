import { useEffect } from 'react';

export type KitchenViewMode = 'board' | 'table' | 'focus';

interface UseKitchenShortcutsOptions {
  onFocusSearch: () => void;
  onToggleFullscreen: () => void;
  onSetView: (view: KitchenViewMode) => void;
  onEscape: () => void;
  enabled?: boolean;
}

/**
 * Kitchen-staff-oriented, not admin-oriented — no Ctrl/Cmd chords (a
 * line cook's hands are often full or gloved; a single unmodified key
 * is the whole point). Ignored while focus is inside a text input,
 * except `Escape`, which always works so it can back out of a search
 * box too.
 */
export function useKitchenShortcuts({
  onFocusSearch,
  onToggleFullscreen,
  onSetView,
  onEscape,
  enabled = true,
}: UseKitchenShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const isTyping = ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;

      if (event.key === 'Escape') {
        onEscape();
        return;
      }
      if (isTyping) return;

      switch (event.key) {
        case '/':
          event.preventDefault();
          onFocusSearch();
          break;
        case 'f':
          onToggleFullscreen();
          break;
        case '1':
          onSetView('board');
          break;
        case '2':
          onSetView('table');
          break;
        case '3':
          onSetView('focus');
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onFocusSearch, onToggleFullscreen, onSetView, onEscape]);
}
