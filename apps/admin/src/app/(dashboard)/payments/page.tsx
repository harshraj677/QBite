import { CreditCard } from 'lucide-react';
import { ComingSoonPage } from '@/components/shared/coming-soon';

export const metadata = { title: 'Payments' };

export default function PaymentsPage() {
  return (
    <ComingSoonPage
      title="Payments"
      pageDescription="Razorpay transactions, refunds, and payment status."
      icon={CreditCard}
      emptyStateDescription="A searchable payments ledger — status, method, refund history — is coming in the next phase."
    />
  );
}
