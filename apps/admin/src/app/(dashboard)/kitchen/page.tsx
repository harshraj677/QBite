import { KitchenOperationsPage } from '@/features/kitchen/components/kitchen-operations-page';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kitchen' };

export default function KitchenPage() {
  return <KitchenOperationsPage />;
}
