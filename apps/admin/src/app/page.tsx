'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/providers/auth-provider';

/** The root route never renders content of its own — it's a pure redirect once the silent-refresh-on-mount resolves, to either the dashboard or the login screen. */
export default function RootPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  return (
    <div className="flex h-svh items-center justify-center">
      <Spinner className="size-6" />
    </div>
  );
}
