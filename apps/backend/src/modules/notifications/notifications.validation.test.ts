import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from './notifications.validation';

describe('notificationIdParamSchema', () => {
  it('accepts a valid ObjectId', () => {
    expect(notificationIdParamSchema.safeParse({ id: '507f1f77bcf86cd799439011' }).success).toBe(
      true,
    );
  });

  it('rejects a malformed id', () => {
    expect(notificationIdParamSchema.safeParse({ id: 'nope' }).success).toBe(false);
  });
});

describe('listNotificationsQuerySchema', () => {
  it('applies defaults when no query params are given', () => {
    const result = listNotificationsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ page: 1, limit: 20, sortOrder: 'desc' });
      expect(result.data.isRead).toBeUndefined();
    }
  });

  it('transforms isRead string to boolean', () => {
    const result = listNotificationsQuerySchema.safeParse({ isRead: 'true' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isRead).toBe(true);
  });

  it('rejects an invalid isRead value', () => {
    expect(listNotificationsQuerySchema.safeParse({ isRead: 'yes' }).success).toBe(false);
  });

  it('rejects a limit above the max page size', () => {
    expect(listNotificationsQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });
});
