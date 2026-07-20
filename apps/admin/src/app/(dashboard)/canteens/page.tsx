import { Store } from 'lucide-react';
import { ComingSoonPage } from '@/components/shared/coming-soon';

export const metadata = { title: 'Canteens' };

export default function CanteensPage() {
  return (
    <ComingSoonPage
      title="Canteens"
      pageDescription="Every canteen on the platform."
      icon={Store}
      emptyStateDescription="Canteen management — create, edit hours, open/close status — is coming in the next phase."
    />
  );
}
