import {
  BarChart3,
  Bell,
  ChefHat,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  ScrollText,
  ShoppingBag,
  Store,
  Tags,
  UserCog,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AdminPanelRole } from '@/types/auth';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Omit to allow every admin-panel role (kitchen_staff/admin/super_admin). */
  roles?: readonly AdminPanelRole[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const ADMIN_ONLY = ['admin', 'super_admin'] as const;

/**
 * The full information architecture, in one place — the sidebar and
 * the command palette (Ctrl+K) both render off this single source,
 * so the two are structurally incapable of drifting apart. Grouped by
 * job-to-be-done, not by backend module boundary (e.g. Students/Staff
 * sit together under "Directory" even though they're two different
 * concerns on the backend) — a sidebar should read the way an admin
 * thinks about their day, not the way the API is partitioned.
 *
 * Every route below exists (see app/(dashboard)/) — most render a
 * polished "coming soon" state for this phase (see EmptyState), not a
 * 404, because the backend endpoints they'd need don't exist yet
 * either (there is no user-listing or audit-log-listing HTTP endpoint
 * in the backend today — see PHASE_1_REPORT.md). Only Dashboard is
 * wired to real data in Phase 1.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { title: 'Analytics', href: '/analytics', icon: BarChart3, roles: ADMIN_ONLY },
    ],
  },
  {
    title: 'Operations',
    items: [
      { title: 'Orders', href: '/orders', icon: ShoppingBag },
      { title: 'Kitchen', href: '/kitchen', icon: ChefHat },
      { title: 'Payments', href: '/payments', icon: CreditCard, roles: ADMIN_ONLY },
      { title: 'Notifications', href: '/notifications', icon: Bell },
    ],
  },
  {
    title: 'Directory',
    items: [
      { title: 'Students', href: '/users/students', icon: Users, roles: ADMIN_ONLY },
      { title: 'Staff', href: '/users/staff', icon: UserCog, roles: ADMIN_ONLY },
      { title: 'Canteens', href: '/canteens', icon: Store, roles: ADMIN_ONLY },
      { title: 'Menu Items', href: '/menu', icon: UtensilsCrossed, roles: ADMIN_ONLY },
      { title: 'Categories', href: '/menu/categories', icon: Tags, roles: ADMIN_ONLY },
    ],
  },
  {
    title: 'Insights',
    items: [
      { title: 'Reports', href: '/reports', icon: FileBarChart, roles: ADMIN_ONLY },
      { title: 'Audit Logs', href: '/audit-logs', icon: ScrollText, roles: ADMIN_ONLY },
    ],
  },
];

export function visibleNavSections(role: AdminPanelRole): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}
