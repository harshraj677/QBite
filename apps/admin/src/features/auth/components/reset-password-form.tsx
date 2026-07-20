'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Eye, EyeOff, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { LoadingButton } from '@/components/shared/loading-button';
import { ApiError } from '@/lib/api/errors';
import { resetPassword as resetPasswordRequest } from '../api';
import { resetPasswordSchema, type ResetPasswordFormValues } from '../schemas';

/** `token` (a 64-char opaque code) is only ever delivered as plain text in the reset email, not a clickable link — see auth.service.ts's forgotPassword. The user pastes it in by hand, so it gets its own field rather than being read from a query param. */
export function ResetPasswordForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: '', newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ResetPasswordFormValues) =>
      resetPasswordRequest(values.token, values.newPassword),
    onSuccess: () => {
      setTimeout(() => router.push('/login'), 2500);
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Something went wrong while resetting your password. Please try again.',
      );
    },
  });

  if (mutation.isSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="size-5" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Password reset</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Every active session has been signed out. Redirecting you to sign in…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Paste the code from your email and choose a new password.
        </p>
      </div>

      {formError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t reset your password</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          mutation.mutate(values);
        })}
        noValidate
      >
        <FieldGroup>
          <Field data-invalid={!!errors.token}>
            <FieldLabel htmlFor="token">Reset code</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="token"
                autoComplete="one-time-code"
                spellCheck={false}
                placeholder="Paste the code from your email"
                className="font-mono text-xs"
                aria-invalid={!!errors.token}
                {...register('token')}
              />
            </InputGroup>
            <FieldError errors={[errors.token]} />
          </Field>

          <Field data-invalid={!!errors.newPassword}>
            <FieldLabel htmlFor="newPassword">New password</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={!!errors.newPassword}
                {...register('newPassword')}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[errors.newPassword]} />
          </Field>

          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                {...register('confirmPassword')}
              />
            </InputGroup>
            <FieldError errors={[errors.confirmPassword]} />
          </Field>

          <LoadingButton
            type="submit"
            className="w-full"
            loading={mutation.isPending}
            loadingText="Resetting…"
          >
            Reset password
          </LoadingButton>

          <Link
            href="/login"
            className="mx-auto text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Back to sign in
          </Link>
        </FieldGroup>
      </form>
    </div>
  );
}
