import { Users } from 'lucide-react';
import { ComingSoonPage } from '@/components/shared/coming-soon';

export const metadata = { title: 'Students' };

export default function StudentsPage() {
  return (
    <ComingSoonPage
      title="Students"
      pageDescription="Every registered student account."
      icon={Users}
      emptyStateDescription="A searchable student directory with order history and account status is coming in a future phase."
    />
  );
}
