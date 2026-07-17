import type { Types } from 'mongoose';

import { logger } from '@logging/logger';
import type { UserRole } from '@modules/users/user.types';
import { AuditLogRepository } from './audit-log.repository';
import type { AuditAction } from './audit-log.types';

export interface RecordAuditInput {
  actorId?: Types.ObjectId;
  actorRole?: UserRole;
  action: AuditAction;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * `audit`'s public interface — per ARCHITECTURE.md §3.1's module
 * boundary rule, every other module (starting with `auth`, now also
 * `menu`) depends on this, never on `AuditLogRepository` directly.
 *
 * Extracted from `modules/auth/` (where `AuditLog` originated) once a
 * second module needed to write audit entries — reaching into auth's
 * internal repository from `menu` would have violated the same
 * boundary rule this module now enforces on its own behalf. Same
 * collection, same schema, same fields; only the module doing the
 * writing changed.
 */
export class AuditLogService {
  constructor(private readonly auditLogRepository: AuditLogRepository = new AuditLogRepository()) {}

  /**
   * Never throws — an audit-logging failure must not break the
   * business operation it's observing. Previously this guarantee
   * lived in each caller (auth.service.ts had its own try/catch);
   * centralizing it here means a future caller can't forget it.
   */
  async record(input: RecordAuditInput): Promise<void> {
    try {
      await this.auditLogRepository.create(input);
    } catch (error) {
      logger.error({ err: error }, 'Failed to write audit log');
    }
  }
}
