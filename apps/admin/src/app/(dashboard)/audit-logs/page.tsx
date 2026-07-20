import { ScrollText } from 'lucide-react';
import { ComingSoonPage } from '@/components/shared/coming-soon';

export const metadata = { title: 'Audit Logs' };

export default function AuditLogsPage() {
  return (
    <ComingSoonPage
      title="Audit Logs"
      pageDescription="A complete trail of every sensitive action taken on the platform."
      icon={ScrollText}
      emptyStateDescription="A searchable audit trail — who did what, when — is coming in a future phase."
    />
  );
}
