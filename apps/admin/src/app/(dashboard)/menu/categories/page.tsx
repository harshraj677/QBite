import { Tags } from 'lucide-react';
import { ComingSoonPage } from '@/components/shared/coming-soon';

export const metadata = { title: 'Categories' };

export default function MenuCategoriesPage() {
  return (
    <ComingSoonPage
      title="Categories"
      pageDescription="Menu categories across every canteen."
      icon={Tags}
      emptyStateDescription="Category management — reordering, activation — is coming in the next phase."
    />
  );
}
