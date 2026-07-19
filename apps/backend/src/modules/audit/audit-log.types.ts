import type { Document, Types } from 'mongoose';

import type { UserRole } from '@modules/users/user.types';

/**
 * Every security/business-relevant event any module can produce. Kept
 * as a closed set (not a free-form string) so a typo can't silently
 * create an untracked, unqueryable action name — the same rationale
 * `auth` used when this lived there. Namespaced by module (`auth.*`,
 * `menu_category.*`, `menu_item.*`) for the same reason error codes
 * are namespaced per docs/API_SPECIFICATION.md §5.2.
 */
export const AUDIT_ACTIONS = [
  // auth
  'auth.register',
  'auth.email.verified',
  'auth.email.verification_failed',
  'auth.login.success',
  'auth.login.failure',
  'auth.logout',
  'auth.token.refreshed',
  'auth.token.reuse_detected',
  'auth.account.locked',
  'auth.password.reset_requested',
  'auth.password.reset_completed',
  // menu_category
  'menu_category.created',
  'menu_category.updated',
  'menu_category.deleted',
  'menu_category.restored',
  'menu_category.reordered',
  // menu_item
  'menu_item.created',
  'menu_item.updated',
  'menu_item.deleted',
  'menu_item.restored',
  'menu_item.availability_updated',
  'menu_item.featured_updated',
  'menu_item.reordered',
  // order
  'order.created',
  // Per-transition, not a single generic 'order.status_updated' — that
  // name was used through the Order-phase and Kitchen Workflow phase's
  // review of it (see orders.service.ts's `statusUpdateAuditAction`
  // and ARCHITECTURE.md §3.1's `modules/kitchen` note) replaced it so
  // both PATCH /orders/:id/status and every Kitchen endpoint that
  // funnels through the same OrdersService.updateStatus method log a
  // precise event instead of an undifferentiated one. Old audit_logs
  // documents written before this change keep their stored
  // 'order.status_updated' value — Mongoose's enum is a write-time
  // validator, not retroactively enforced on existing documents.
  'order.accepted',
  'order.preparing',
  'order.ready',
  'order.completed',
  'order.cancelled',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actorId?: Types.ObjectId;
  actorRole?: UserRole;
  action: AuditAction;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
