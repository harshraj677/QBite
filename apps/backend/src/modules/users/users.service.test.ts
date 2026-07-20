import { Types } from 'mongoose';

import { ConflictError, ForbiddenError, NotFoundError } from '@errors/http-errors';
import type { AuditLogService } from '@modules/audit/audit-log.service';
import { UsersService } from './users.service';
import type { UsersRepository } from './users.repository';
import type { IUser, UserRole } from './user.types';

const meta = {};
const actorId = new Types.ObjectId().toString();

function makeUser(overrides: Partial<IUser> = {}): IUser {
  return {
    _id: new Types.ObjectId(),
    fullName: 'Test User',
    collegeEmail: 'test@college.edu',
    phoneNumber: '+919876543210',
    role: 'student' as UserRole,
    isEmailVerified: false,
    isActive: true,
    failedLoginAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as IUser;
}

function makeMockRepository(): jest.Mocked<UsersRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdWithPassword: jest.fn(),
    findByCollegeEmail: jest.fn(),
    findByCollegeEmailWithPassword: jest.fn(),
    findByUsn: jest.fn(),
    findByUsnWithPassword: jest.fn(),
    findByPhoneNumber: jest.fn(),
    setEmailVerified: jest.fn(),
    updatePasswordHash: jest.fn(),
    recordFailedLogin: jest.fn(),
    resetFailedLoginAttempts: jest.fn(),
    updateLastLoginAt: jest.fn(),
    getRoleCounts: jest.fn(),
    countNewUsers: jest.fn(),
    findByIds: jest.fn(),
    search: jest.fn(),
    updateRole: jest.fn(),
    setActive: jest.fn(),
    countActive: jest.fn(),
  } as unknown as jest.Mocked<UsersRepository>;
}

function makeMockAuditLogService(): jest.Mocked<AuditLogService> {
  return {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditLogService>;
}

function makeService() {
  const repository = makeMockRepository();
  const auditLogService = makeMockAuditLogService();
  return { service: new UsersService(repository, auditLogService), repository, auditLogService };
}

describe('UsersService.updateRole', () => {
  it('throws NotFoundError when the target does not exist', async () => {
    const { service, repository } = makeService();
    repository.findById.mockResolvedValue(null);

    await expect(
      service.updateRole('missing', 'admin', { id: actorId, role: 'super_admin' }, meta),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a self role change', async () => {
    const { service, repository } = makeService();
    const target = makeUser({ role: 'admin' });
    repository.findById.mockResolvedValue(target);

    await expect(
      service.updateRole(
        target._id.toString(),
        'super_admin',
        { id: target._id.toString(), role: 'admin' },
        meta,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repository.updateRole).not.toHaveBeenCalled();
  });

  it('rejects an admin assigning super_admin', async () => {
    const { service, repository } = makeService();
    const target = makeUser({ role: 'kitchen_staff' });
    repository.findById.mockResolvedValue(target);

    await expect(
      service.updateRole(
        target._id.toString(),
        'super_admin',
        { id: actorId, role: 'admin' },
        meta,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.updateRole).not.toHaveBeenCalled();
  });

  it('rejects an admin demoting a super_admin', async () => {
    const { service, repository } = makeService();
    const target = makeUser({ role: 'super_admin' });
    repository.findById.mockResolvedValue(target);

    await expect(
      service.updateRole(target._id.toString(), 'admin', { id: actorId, role: 'admin' }, meta),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.updateRole).not.toHaveBeenCalled();
  });

  it('rejects demoting the last active super_admin', async () => {
    const { service, repository } = makeService();
    const target = makeUser({ role: 'super_admin' });
    repository.findById.mockResolvedValue(target);
    repository.countActive.mockResolvedValue(0);

    await expect(
      service.updateRole(
        target._id.toString(),
        'admin',
        { id: actorId, role: 'super_admin' },
        meta,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repository.updateRole).not.toHaveBeenCalled();
  });

  it('allows demoting a super_admin when another active one remains', async () => {
    const { service, repository, auditLogService } = makeService();
    const target = makeUser({ role: 'super_admin' });
    repository.findById.mockResolvedValue(target);
    repository.countActive.mockResolvedValue(1);
    repository.updateRole.mockResolvedValue(makeUser({ ...target, role: 'admin' }));

    const result = await service.updateRole(
      target._id.toString(),
      'admin',
      { id: actorId, role: 'super_admin' },
      meta,
    );

    expect(result.role).toBe('admin');
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.role_updated' }),
    );
  });

  it('allows an admin to promote a student to kitchen_staff', async () => {
    const { service, repository } = makeService();
    const target = makeUser({ role: 'student' });
    repository.findById.mockResolvedValue(target);
    repository.updateRole.mockResolvedValue(makeUser({ ...target, role: 'kitchen_staff' }));

    const result = await service.updateRole(
      target._id.toString(),
      'kitchen_staff',
      { id: actorId, role: 'admin' },
      meta,
    );

    expect(result.role).toBe('kitchen_staff');
    expect(repository.countActive).not.toHaveBeenCalled();
  });
});

describe('UsersService.setActive', () => {
  it('throws NotFoundError when the target does not exist', async () => {
    const { service, repository } = makeService();
    repository.findById.mockResolvedValue(null);

    await expect(
      service.setActive('missing', false, { id: actorId, role: 'admin' }, meta),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects self-deactivation', async () => {
    const { service, repository } = makeService();
    const target = makeUser({ role: 'admin' });
    repository.findById.mockResolvedValue(target);

    await expect(
      service.setActive(
        target._id.toString(),
        false,
        { id: target._id.toString(), role: 'admin' },
        meta,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repository.setActive).not.toHaveBeenCalled();
  });

  it('rejects deactivating the last active admin-capable account', async () => {
    const { service, repository } = makeService();
    const target = makeUser({ role: 'admin' });
    repository.findById.mockResolvedValue(target);
    repository.countActive.mockResolvedValue(0);

    await expect(
      service.setActive(target._id.toString(), false, { id: actorId, role: 'super_admin' }, meta),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repository.setActive).not.toHaveBeenCalled();
  });

  it('allows deactivating an admin when another active admin-capable account remains', async () => {
    const { service, repository, auditLogService } = makeService();
    const target = makeUser({ role: 'admin' });
    repository.findById.mockResolvedValue(target);
    repository.countActive.mockResolvedValue(1);
    repository.setActive.mockResolvedValue(makeUser({ ...target, isActive: false }));

    const result = await service.setActive(
      target._id.toString(),
      false,
      { id: actorId, role: 'super_admin' },
      meta,
    );

    expect(result.isActive).toBe(false);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.deactivated' }),
    );
  });

  it('does not run the last-admin guard for a student', async () => {
    const { service, repository } = makeService();
    const target = makeUser({ role: 'student' });
    repository.findById.mockResolvedValue(target);
    repository.setActive.mockResolvedValue(makeUser({ ...target, isActive: false }));

    await service.setActive(target._id.toString(), false, { id: actorId, role: 'admin' }, meta);

    expect(repository.countActive).not.toHaveBeenCalled();
  });

  it('records user.activated when reactivating', async () => {
    const { service, repository, auditLogService } = makeService();
    const target = makeUser({ role: 'student', isActive: false });
    repository.findById.mockResolvedValue(target);
    repository.setActive.mockResolvedValue(makeUser({ ...target, isActive: true }));

    await service.setActive(target._id.toString(), true, { id: actorId, role: 'admin' }, meta);

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.activated' }),
    );
  });
});

describe('UsersService.searchUsers', () => {
  it('delegates to the repository', async () => {
    const { service, repository } = makeService();
    repository.search.mockResolvedValue({ users: [], total: 0 });

    const options = {
      page: 1,
      limit: 20,
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
    };
    await service.searchUsers(options);

    expect(repository.search).toHaveBeenCalledWith(options);
  });
});
