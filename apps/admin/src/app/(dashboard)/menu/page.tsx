import { UtensilsCrossed } from 'lucide-react';
import { ComingSoonPage } from '@/components/shared/coming-soon';

export const metadata = { title: 'Menu Items' };

export default function MenuPage() {
  return (
    <ComingSoonPage
      title="Menu Items"
      pageDescription="Every menu item across every canteen."
      icon={UtensilsCrossed}
      emptyStateDescription="Menu item management — pricing, availability, featured items — is coming in the next phase."
    />
  );
}
