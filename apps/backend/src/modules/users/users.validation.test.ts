import {
  listUsersQuerySchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  userIdParamSchema,
} from './users.validation';

describe('userIdParamSchema', () => {
  it('accepts a valid ObjectId', () => {
    expect(userIdParamSchema.safeParse({ id: '507f1f77bcf86cd799439011' }).success).toBe(true);
  });

  it('rejects a malformed id', () => {
    expect(userIdParamSchema.safeParse({ id: 'nope' }).success).toBe(false);
  });

  it('rejects a missing id', () => {
    expect(userIdParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('listUsersQuerySchema', () => {
  it('applies defaults when no query params are given', () => {
    const result = listUsersQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    }
  });

  it('accepts every real role as a filter', () => {
    for (const role of ['student', 'kitchen_staff', 'admin', 'super_admin']) {
      expect(listUsersQuerySchema.safeParse({ role }).success).toBe(true);
    }
  });

  it('rejects an invalid role', () => {
    expect(listUsersQuerySchema.safeParse({ role: 'teacher' }).success).toBe(false);
  });

  it('rejects a limit above the max page size', () => {
    expect(listUsersQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });

  it('accepts every sortable field', () => {
    for (const sortBy of ['fullName', 'collegeEmail', 'createdAt', 'lastLoginAt']) {
      expect(listUsersQuerySchema.safeParse({ sortBy }).success).toBe(true);
    }
  });

  // Same z.coerce.boolean() pitfall as kitchen.validation.ts's includeItems —
  // Boolean("false") is true in plain JS.
  describe('isActive / isEmailVerified', () => {
    it('parses "true" as true', () => {
      const result = listUsersQuerySchema.safeParse({ isActive: 'true', isEmailVerified: 'true' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
        expect(result.data.isEmailVerified).toBe(true);
      }
    });

    it('parses the literal string "false" as false, not true', () => {
      const result = listUsersQuerySchema.safeParse({
        isActive: 'false',
        isEmailVerified: 'false',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(false);
        expect(result.data.isEmailVerified).toBe(false);
      }
    });

    it('is undefined when omitted', () => {
      const result = listUsersQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBeUndefined();
        expect(result.data.isEmailVerified).toBeUndefined();
      }
    });

    it('rejects a non-boolean-ish value', () => {
      expect(listUsersQuerySchema.safeParse({ isActive: 'yes' }).success).toBe(false);
    });
  });
});

describe('updateUserRoleSchema', () => {
  it('accepts every real role', () => {
    for (const role of ['student', 'kitchen_staff', 'admin', 'super_admin']) {
      expect(updateUserRoleSchema.safeParse({ role }).success).toBe(true);
    }
  });

  it('rejects an invalid role', () => {
    expect(updateUserRoleSchema.safeParse({ role: 'teacher' }).success).toBe(false);
  });

  it('rejects a missing role', () => {
    expect(updateUserRoleSchema.safeParse({}).success).toBe(false);
  });
});

describe('updateUserStatusSchema', () => {
  it('accepts a boolean isActive', () => {
    expect(updateUserStatusSchema.safeParse({ isActive: true }).success).toBe(true);
    expect(updateUserStatusSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it('rejects a string isActive (body booleans are real JSON booleans, not query strings)', () => {
    expect(updateUserStatusSchema.safeParse({ isActive: 'true' }).success).toBe(false);
  });

  it('rejects a missing isActive', () => {
    expect(updateUserStatusSchema.safeParse({}).success).toBe(false);
  });
});
