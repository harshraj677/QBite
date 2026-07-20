import { UserCog } from 'lucide-react';
import { ComingSoonPage } from '@/components/shared/coming-soon';

export const metadata = { title: 'Staff' };

export default function StaffPage() {
  return (
    <ComingSoonPage
      title="Staff"
      pageDescription="Kitchen staff, admins, and super admins."
      icon={UserCog}
      emptyStateDescription="Staff account management — roles, canteen assignment, activation — is coming in a future phase."
    />
  );
}
