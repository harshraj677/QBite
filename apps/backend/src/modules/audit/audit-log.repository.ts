import type { Types } from 'mongoose';

import { AuditLogModel } from './audit-log.model';
import type { AuditAction, IAuditLog } from './audit-log.types';
import type { UserRole } from '@modules/users/user.types';

export interface CreateAuditLogInput {
  actorId?: Types.ObjectId;
  actorRole?: UserRole;
  action: AuditAction;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export class AuditLogRepository {
  create(input: CreateAuditLogInput): Promise<IAuditLog> {
    return AuditLogModel.create(input);
  }
}
