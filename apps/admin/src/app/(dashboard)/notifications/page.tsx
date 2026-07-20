import { Bell } from 'lucide-react';
import { ComingSoonPage } from '@/components/shared/coming-soon';

export const metadata = { title: 'Notifications' };

export default function NotificationsPage() {
  return (
    <ComingSoonPage
      title="Notifications"
      pageDescription="Your full notification history."
      icon={Bell}
      emptyStateDescription="The full notifications feed — mark as read, filter by type — is coming in the next phase. The unread count in the top bar is already live."
    />
  );
}
