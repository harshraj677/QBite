'use client';

import { CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Logo } from '@/components/shared/logo';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/providers/auth-provider';

const HIGHLIGHTS = [
  'Real-time revenue, order, and kitchen visibility across every campus canteen.',
  'Role-scoped access — admins, super admins, and kitchen staff each see exactly what they need.',
  'Built directly on the production QBite API — every number here is real.',
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  if (status === 'authenticated') {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Branding panel — hidden below `lg`, where the form alone gets the full viewport. */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--color-primary)_0%,transparent_45%)] opacity-[0.08]"
        />
        <Logo />
        <div className="relative space-y-8">
          <blockquote className="text-2xl font-medium text-balance text-foreground">
            The operations console for QBite&apos;s campus canteens.
          </blockquote>
          <ul className="space-y-4">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-pretty">{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} QBite. All rights reserved.
        </p>
      </div>

      {/* Form panel. */}
      <div className="flex flex-col p-6 sm:p-10">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden">
            <Logo />
          </div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
