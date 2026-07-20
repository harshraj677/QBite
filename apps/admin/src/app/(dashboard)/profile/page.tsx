'use client';

import { format } from 'date-fns';
import { KeyRound, Mail, Phone, ShieldCheck, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { useAuth } from '@/providers/auth-provider';

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  kitchen_staff: 'Kitchen Staff',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your account details." />

      <Card>
        <CardContent className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar className="size-16">
            <AvatarFallback className="text-lg">{initials(user.fullName)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h2 className="text-lg font-semibold text-foreground">{user.fullName}</h2>
              <Badge variant="secondary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
              {user.isEmailVerified && (
                <Badge variant="success" className="gap-1">
                  <ShieldCheck className="size-3" />
                  Verified
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{user.collegeEmail}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {user.usn && (
            <div className="flex items-start gap-3">
              <UserIcon className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">USN</p>
                <p className="text-sm font-medium text-foreground">{user.usn}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">College email</p>
              <p className="text-sm font-medium text-foreground">{user.collegeEmail}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Phone number</p>
              <p className="text-sm font-medium text-foreground">{user.phoneNumber}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Member since</p>
              <p className="text-sm font-medium text-foreground">
                {format(new Date(user.createdAt), 'MMMM d, yyyy')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            Change your password by requesting a reset code to your college email.
          </p>
          <Button variant="outline" size="sm" render={<Link href="/forgot-password" />}>
            <KeyRound />
            Reset password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
