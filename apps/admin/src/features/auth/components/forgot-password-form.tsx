'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/shared/loading-button';
import { requestPasswordReset } from '../api';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../schemas';

export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { collegeEmail: '' },
  });

  const mutation = useMutation({ mutationFn: requestPasswordReset });

  if (mutation.isSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-success/10 text-success">
          <MailCheck className="size-5" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Check your email</h1>
          <p className="text-sm text-balance text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{getValues('collegeEmail')}</span>,
            a password reset code is on its way.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Forgot password?</h1>
        <p className="text-sm text-muted-foreground">
          Enter your college email and we&apos;ll send you a reset code.
        </p>
      </div>

      <form onSubmit={handleSubmit((values) => mutation.mutate(values.collegeEmail))} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.collegeEmail}>
            <FieldLabel htmlFor="collegeEmail">College email</FieldLabel>
            <Input
              id="collegeEmail"
              type="email"
              autoComplete="email"
              placeholder="you@college.edu"
              aria-invalid={!!errors.collegeEmail}
              {...register('collegeEmail')}
            />
            <FieldError errors={[errors.collegeEmail]} />
          </Field>

          <LoadingButton
            type="submit"
            className="w-full"
            loading={mutation.isPending}
            loadingText="Sending…"
          >
            Send reset code
          </LoadingButton>

          <Link
            href="/login"
            className="mx-auto flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
        </FieldGroup>
      </form>
    </div>
  );
}
