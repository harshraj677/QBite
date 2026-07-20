'use client';

import { motion } from 'motion/react';
import { ChefHat, CreditCard, FileBarChart, ShoppingBag, UsersRound, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const ACTIONS: QuickAction[] = [
  { title: 'Manage orders', description: 'Track and update every order', href: '/orders', icon: ShoppingBag },
  { title: 'Kitchen', description: "Today's kitchen queue", href: '/kitchen', icon: ChefHat },
  { title: 'Manage menu', description: 'Items, pricing, availability', href: '/menu', icon: UtensilsCrossed },
  { title: 'Payments', description: 'Transactions and refunds', href: '/payments', icon: CreditCard },
  { title: 'Users', description: 'Students and staff accounts', href: '/users/students', icon: UsersRound },
  { title: 'Reports', description: 'Export and scheduled reports', href: '/reports', icon: FileBarChart },
];

/** Every target route already exists (see nav-config.ts) — most currently render a "coming soon" state, same as reaching them via the sidebar. This isn't a shortcut around that; it's the same destination, just surfaced as a shortcut from the dashboard. */
export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {ACTIONS.map((action, index) => (
        <motion.div
          key={action.href}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: index * 0.04 }}
        >
          <Link
            href={action.href}
            className="group flex h-full flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
              <action.icon className="size-4.5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{action.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{action.description}</p>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
