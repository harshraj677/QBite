'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppTopbar } from '@/components/layout/app-topbar';
import { CommandPaletteProvider } from '@/components/layout/command-palette';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/providers/auth-provider';

/** A structural echo of the real shell (sidebar rail + topbar bar) rather than a bare spinner — the layout doesn't jump the instant auth resolves. */
function ShellSkeleton() {
  return (
    <div className="flex h-svh w-full">
      <div className="hidden w-64 shrink-0 border-r p-3 md:block">
        <Skeleton className="mb-6 h-7 w-28" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center border-b px-4">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-64" />
        </div>
      </div>
    </div>
  );
}

/**
 * The auth gate for every admin-panel route. Deliberately client-side
 * only — see providers/auth-provider.tsx's doc comment on why
 * server-side middleware can't see the httpOnly refresh cookie (it's
 * scoped to `/api/v1/auth` on the *backend's* origin, a path the
 * browser never attaches to a request for one of *this* app's own
 * pages). `status === 'loading'` covers exactly the one silent-refresh
 * round trip on first mount; every subsequent navigation is instant.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status !== 'authenticated') {
    return <ShellSkeleton />;
  }

  return (
    <CommandPaletteProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppTopbar />
          <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </CommandPaletteProvider>
  );
}
