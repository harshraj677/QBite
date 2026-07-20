import { Settings } from 'lucide-react';
import { ComingSoonPage } from '@/components/shared/coming-soon';

export const metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <ComingSoonPage
      title="Settings"
      pageDescription="Platform preferences and configuration."
      icon={Settings}
      emptyStateDescription="Platform-wide settings are coming in a future phase."
    />
  );
}
