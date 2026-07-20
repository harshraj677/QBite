import { ChefHat } from 'lucide-react';
import { ComingSoonPage } from '@/components/shared/coming-soon';

export const metadata = { title: 'Kitchen' };

export default function KitchenPage() {
  return (
    <ComingSoonPage
      title="Kitchen"
      pageDescription="Live kitchen queue and order status board."
      icon={ChefHat}
      emptyStateDescription="A real-time kitchen ticket queue — accept, start preparing, mark ready, complete — is coming in the next phase."
    />
  );
}
