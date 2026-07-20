import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wraps the real browser Fullscreen API on one container ref, not the
 * whole document — when just the board's own element goes fullscreen,
 * the browser replaces the entire viewport with it, sidebar/topbar
 * included, with zero changes to the shared `(dashboard)/layout.tsx`
 * shell every other page also uses. This is what makes "Fullscreen /
 * Kitchen TV Mode" achievable without touching approved, shared
 * infrastructure.
 */
export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(document.fullscreenElement === ref.current);
    }
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const enter = useCallback(() => {
    void ref.current?.requestFullscreen();
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
  }, []);

  const toggle = useCallback(() => {
    if (isFullscreen) exit();
    else enter();
  }, [isFullscreen, enter, exit]);

  return { ref, isFullscreen, enter, exit, toggle };
}
