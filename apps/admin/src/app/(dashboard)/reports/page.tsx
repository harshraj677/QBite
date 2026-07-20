import { FileBarChart } from 'lucide-react';
import { ComingSoonPage } from '@/components/shared/coming-soon';

export const metadata = { title: 'Reports' };

export default function ReportsPage() {
  return (
    <ComingSoonPage
      title="Reports"
      pageDescription="Exportable operational reports."
      icon={FileBarChart}
      emptyStateDescription="Downloadable revenue, order, and staff performance reports are coming in a future phase."
    />
  );
}
