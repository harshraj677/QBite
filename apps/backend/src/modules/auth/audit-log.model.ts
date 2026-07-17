import { model, Schema } from 'mongoose';

import type { IAuditLog } from './auth.types';
import { AUDIT_ACTIONS } from './auth.types';
import { USER_ROLES } from '@modules/users/user.types';

/**
 * No TTL index, deliberately — unlike the other 3 models in this
 * module, audit logs are a compliance/security-forensics record, not
 * ephemeral session state. Retention policy (if any) is an
 * operational decision for later, not an automatic MongoDB expiry.
 */
const auditLogSchema = new Schema<IAuditLog>({
  actorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  actorRole: {
    type: String,
    enum: USER_ROLES,
  },
  action: {
    type: String,
    enum: AUDIT_ACTIONS,
    required: true,
    index: true,
  },
  success: {
    type: Boolean,
    required: true,
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  metadata: {
    type: Schema.Types.Mixed,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

export const AuditLogModel = model<IAuditLog>('AuditLog', auditLogSchema);
